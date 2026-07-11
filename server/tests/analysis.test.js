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
            email: 'free@example.com',
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
            .send({ email: 'free@example.com', password: 'Password123!' });
            
        // Extract token from cookie
        const cookies = res.headers['set-cookie'];
        const cookie = cookies.find(c => c.startsWith('accessToken='));
        accessToken = cookie.split(';')[0];
    });

    it('should allow free user to analyze up to 10 times', async () => {
        // We mainly test the limit logic. Set the user's analysis count to 10.
        await User.findByIdAndUpdate(userId, { analysisCount: 10 });
        
        // 11th time - SHOULD FAIL
        const res = await request(app)
            .post('/api/analysis/start')
            .set('Cookie', accessToken)
            .send({ url: 'ask.com' });
        
        expect(res.statusCode).toBe(403);
        expect(res.body.message).toContain('daily limit');
    });

    it('should allow pro user unlimited analyses', async () => {
        // Upgrade user to pro
        await User.findByIdAndUpdate(userId, { plan: 'pro', analysisCount: 3 });

        // Even with count 3, it should allow because plan is pro
        const res = await request(app)
            .post('/api/analysis/start')
            .set('Cookie', accessToken)
            .send({ url: 'google.com' });
            
        expect(res.statusCode).not.toBe(403);
    });
});
