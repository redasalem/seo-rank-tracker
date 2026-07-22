import request from 'supertest';
import app from '../server.js';
import User from '../models/User.js';
import RegistrationToken from '../models/RegistrationToken.js';

describe('Auth Endpoints', () => {
    const testUser = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'Password123!',
    };

    it('should request registration successfully', async () => {
        const res = await request(app)
            .post('/api/auth/request-registration')
            .send({ email: testUser.email });
        
        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toBe(true);
        expect(res.body.message).toBe('Registration link sent. Please check your email.');

        // Check if token is in database
        const regToken = await RegistrationToken.findOne({ email: testUser.email });
        expect(regToken).toBeTruthy();
        expect(regToken.token).toBeDefined();
    });

    it('should complete registration successfully', async () => {
        // Step 1: Request registration
        await request(app)
            .post('/api/auth/request-registration')
            .send({ email: testUser.email });

        const regToken = await RegistrationToken.findOne({ email: testUser.email });

        // Step 2: Complete registration
        const res = await request(app)
            .post('/api/auth/complete-registration')
            .send({
                token: regToken.token,
                name: testUser.name,
                password: testUser.password
            });

        expect(res.statusCode).toEqual(201);
        expect(res.body.success).toBe(true);
        expect(res.body.message).toBe('Registration complete');
        expect(res.body.token).toBeDefined();

        // Check if user is created and verified in database
        const userInDb = await User.findOne({ email: testUser.email });
        expect(userInDb).toBeTruthy();
        expect(userInDb.name).toBe(testUser.name);
        expect(userInDb.isEmailVerified).toBe(true);
    });

    it('should not request registration for existing user', async () => {
        // Register user first
        await request(app).post('/api/auth/request-registration').send({ email: testUser.email });
        const regToken = await RegistrationToken.findOne({ email: testUser.email });
        await request(app).post('/api/auth/complete-registration').send({
            token: regToken.token,
            name: testUser.name,
            password: testUser.password
        });
        
        // Try requesting registration again with existing email
        const res = await request(app)
            .post('/api/auth/request-registration')
            .send({ email: testUser.email });
            
        expect(res.statusCode).toEqual(400);
        expect(res.body.message).toBe('User already exists');
    });

    it('should verify email token successfully', async () => {
        // Create an unverified user with verification token directly in DB
        const user = await User.create({
            name: testUser.name,
            email: testUser.email,
            password: 'hashedpassword',
            isEmailVerified: false,
            isVerified: false,
            emailVerificationToken: 'test-verification-token-123'
        });

        // Call GET /api/auth/verify-email/:token
        const res = await request(app)
            .get(`/api/auth/verify-email/${user.emailVerificationToken}`);

        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toBe(true);
        expect(res.body.message).toBe('Email verified successfully. You can now log in.');

        const updatedUser = await User.findById(user._id);
        expect(updatedUser.isEmailVerified).toBe(true);
        expect(updatedUser.isVerified).toBe(true);
    });

    it('should login an existing verified user', async () => {
        // Register user via magic link
        await request(app).post('/api/auth/request-registration').send({ email: testUser.email });
        const regToken = await RegistrationToken.findOne({ email: testUser.email });
        await request(app).post('/api/auth/complete-registration').send({
            token: regToken.token,
            name: testUser.name,
            password: testUser.password
        });

        const res = await request(app)
            .post('/api/auth/login')
            .send({
                email: testUser.email,
                password: testUser.password
            });
            
        expect(res.statusCode).toEqual(200);
        expect(res.body.success).toBe(true);
        expect(res.body.user.email).toBe(testUser.email);
        
        // Should set HttpOnly cookie
        expect(res.headers['set-cookie']).toBeDefined();
        const cookie = res.headers['set-cookie'].join(';');
        expect(cookie).toContain('accessToken');
    });

    it('should not login with wrong password', async () => {
        await request(app).post('/api/auth/request-registration').send({ email: testUser.email });
        const regToken = await RegistrationToken.findOne({ email: testUser.email });
        await request(app).post('/api/auth/complete-registration').send({
            token: regToken.token,
            name: testUser.name,
            password: testUser.password
        });

        const res = await request(app)
            .post('/api/auth/login')
            .send({
                email: testUser.email,
                password: 'WrongPassword!123'
            });
            
        expect(res.statusCode).toEqual(401);
        expect(res.body.message).toBe('Invalid credentials');
    });

    it('should not login if email is unverified', async () => {
        const bcrypt = (await import('bcrypt')).default;
        const hashedPassword = await bcrypt.hash(testUser.password, 10);
        
        await User.create({
            name: testUser.name,
            email: testUser.email,
            password: hashedPassword,
            isEmailVerified: false,
            isVerified: false
        });

        const res = await request(app)
            .post('/api/auth/login')
            .send({
                email: testUser.email,
                password: testUser.password
            });

        expect(res.statusCode).toEqual(403);
        expect(res.body.notVerified).toBe(true);
    });
});
