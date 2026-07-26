import request from 'supertest';
import app from '../server.js';
import User from '../models/User.js';

describe('Analysis Endpoints (Plan Limits)', () => {
    let accessToken;
    let userId;

    beforeEach(async () => {
        const bcrypt = await import('bcrypt');
        const hashedPassword = await bcrypt.hash('Password123!', 10);
        const user = await User.create({
            name: 'Free User',
            email: 'free@valid-domain.com',
            password: hashedPassword,
            isEmailVerified: true,
            isVerified: true,
            plan: 'free',
            analysisCount: 0
        });
        userId = user._id;

        // Login to get token
        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'free@valid-domain.com', password: 'Password123!' });
            
        // Extract token from cookie
        const cookies = res.headers['set-cookie'];
        const cookie = cookies.find(c => c.startsWith('accessToken='));
        accessToken = cookie.split(';')[0];
    });

    it('should allow free user to analyze up to 5 times', async () => {
        // We mainly test the limit logic. Set the user's analysis count to 5 and date to today so it doesn't reset to 0.
        await User.findByIdAndUpdate(userId, { analysisCount: 5, lastAnalysisDate: new Date() });
        
        // 6th time - SHOULD FAIL
        const res = await request(app)
            .post('/api/analysis/start')
            .set('Cookie', accessToken)
            .send({ url: 'ask.com' });
        
        expect(res.statusCode).toBe(403);
        expect(res.body.message).toContain('daily limit');
    });

    it('should limit pro user to 20 analyses', async () => {
        // Upgrade user to pro and set count to 20
        await User.findByIdAndUpdate(userId, { plan: 'pro', analysisCount: 20, lastAnalysisDate: new Date() });

        // 21st time - SHOULD FAIL
        const res = await request(app)
            .post('/api/analysis/start')
            .set('Cookie', accessToken)
            .send({ url: 'google.com' });
            
        expect(res.statusCode).toBe(403);
        expect(res.body.message).toContain('daily limit');
    });
});
