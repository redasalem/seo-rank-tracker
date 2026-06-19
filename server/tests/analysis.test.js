import request from 'supertest';
import app from '../server.js';
import User from '../models/User.js';

describe('Analysis Endpoints (Plan Limits)', () => {
    let accessToken;
    let userId;

    beforeEach(async () => {
        // Create a verified free user before each test
        const user = await User.create({
            name: 'Free User',
            email: 'free@example.com',
            password: 'Password123!',
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

    it('should allow free user to analyze up to 3 times', async () => {
        // Mock the SEO service or just expect it to fail gracefully if no real URL
        // We mainly test the limit logic
        
        // 1st time
        let res = await request(app)
            .post('/api/analysis/start')
            .set('Cookie', accessToken)
            .send({ url: 'google.com' });
        expect(res.statusCode).not.toBe(403);

        // 2nd time
        res = await request(app)
            .post('/api/analysis/start')
            .set('Cookie', accessToken)
            .send({ url: 'bing.com' });
        expect(res.statusCode).not.toBe(403);

        // 3rd time
        res = await request(app)
            .post('/api/analysis/start')
            .set('Cookie', accessToken)
            .send({ url: 'yahoo.com' });
        expect(res.statusCode).not.toBe(403);

        // 4th time - SHOULD FAIL
        res = await request(app)
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
