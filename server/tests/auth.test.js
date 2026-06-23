import request from 'supertest';
import app from '../server.js';
import User from '../models/User.js';

describe('Auth Endpoints', () => {
    const testUser = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'Password123!',
    };

    it('should register a new user successfully', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send(testUser);
        
        expect(res.statusCode).toEqual(201);
        expect(res.body.success).toBe(true);
        expect(res.body.message).toBe('User registered successfully.');

        // Check if user is in database
        const userInDb = await User.findOne({ email: testUser.email });
        expect(userInDb).toBeTruthy();
        expect(userInDb.name).toBe(testUser.name);
        expect(userInDb.isVerified).toBe(true); // Auto-verified
        expect(res.headers['set-cookie']).toBeDefined(); // Should set token cookie on register
    });

    it('should not register user with existing email', async () => {
        // Create user first
        await request(app).post('/api/auth/register').send(testUser);
        
        // Try again
        const res = await request(app)
            .post('/api/auth/register')
            .send(testUser);
            
        expect(res.statusCode).toEqual(400);
        expect(res.body.message).toBe('User already exists');
    });

    it('should login an existing user', async () => {
        // Register user
        await request(app).post('/api/auth/register').send(testUser);

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
        await request(app).post('/api/auth/register').send(testUser);

        const res = await request(app)
            .post('/api/auth/login')
            .send({
                email: testUser.email,
                password: 'WrongPassword!123'
            });
            
        expect(res.statusCode).toEqual(401);
        expect(res.body.message).toBe('Invalid credentials');
    });
});
