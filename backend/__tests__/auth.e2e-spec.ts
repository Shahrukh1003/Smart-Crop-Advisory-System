import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Auth Flow (e2e)', () => {
    let app: INestApplication;
    let accessToken: string;
    let refreshToken: string;

    const testUser = {
        phoneNumber: `+91${Date.now().toString().slice(-10)}`,
        name: 'Test User',
        password: 'TestPassword123!',
        language: 'en',
    };

    beforeAll(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        }).compile();

        app = moduleFixture.createNestApplication();
        app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
        await app.init();
    });

    afterAll(async () => {
        await app.close();
    });

    it('POST /auth/register - should register a new user', async () => {
        const res = await request(app.getHttpServer())
            .post('/api/v1/auth/register')
            .send(testUser)
            .expect(201);

        expect(res.body).toHaveProperty('user');
        expect(res.body).toHaveProperty('tokens');
        expect(res.body.user.phoneNumber).toBe(testUser.phoneNumber);
        expect(res.body.user.name).toBe(testUser.name);
        expect(res.body.tokens).toHaveProperty('accessToken');
        expect(res.body.tokens).toHaveProperty('refreshToken');

        accessToken = res.body.tokens.accessToken;
        refreshToken = res.body.tokens.refreshToken;
    });

    it('POST /auth/register - should reject duplicate phone', async () => {
        await request(app.getHttpServer())
            .post('/api/v1/auth/register')
            .send(testUser)
            .expect(409);
    });

    it('POST /auth/login - should login with valid credentials', async () => {
        const res = await request(app.getHttpServer())
            .post('/api/v1/auth/login')
            .send({
                phoneNumber: testUser.phoneNumber,
                password: testUser.password,
            })
            .expect(200);

        expect(res.body.tokens).toHaveProperty('accessToken');
        accessToken = res.body.tokens.accessToken;
        refreshToken = res.body.tokens.refreshToken;
    });

    it('POST /auth/login - should reject invalid password', async () => {
        await request(app.getHttpServer())
            .post('/api/v1/auth/login')
            .send({
                phoneNumber: testUser.phoneNumber,
                password: 'WrongPassword',
            })
            .expect(401);
    });

    it('GET /auth/profile - should return user profile with valid token', async () => {
        const res = await request(app.getHttpServer())
            .get('/api/v1/auth/profile')
            .set('Authorization', `Bearer ${accessToken}`)
            .expect(200);

        expect(res.body.phoneNumber).toBe(testUser.phoneNumber);
    });

    it('GET /auth/profile - should reject without token', async () => {
        await request(app.getHttpServer())
            .get('/api/v1/auth/profile')
            .expect(401);
    });

    it('POST /auth/refresh - should refresh tokens', async () => {
        const res = await request(app.getHttpServer())
            .post('/api/v1/auth/refresh')
            .send({ refreshToken })
            .expect(200);

        expect(res.body.tokens).toHaveProperty('accessToken');
        expect(res.body.tokens).toHaveProperty('refreshToken');
    });

    it('POST /auth/login - should reject invalid phone number format', async () => {
        await request(app.getHttpServer())
            .post('/api/v1/auth/login')
            .send({ phoneNumber: '', password: '' })
            .expect(400);
    });
});
