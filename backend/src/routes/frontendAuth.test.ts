import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

const mocks = vi.hoisted(() => ({
  findUser: vi.fn(),
  createUser: vi.fn(),
  updateUser: vi.fn(),
  findVerification: vi.fn(),
  createVerification: vi.fn(),
  updateManyVerifications: vi.fn(),
  updateVerification: vi.fn(),
  deleteVerification: vi.fn(),
  deleteManyVerifications: vi.fn(),
  transaction: vi.fn(),
  sendEmail: vi.fn(),
  emailConfigured: vi.fn(),
  verifyGoogle: vi.fn(),
}));

vi.mock('../lib/prisma', () => ({
  prisma: {
    frontendUser: {
      findUnique: mocks.findUser,
      create: mocks.createUser,
      update: mocks.updateUser,
    },
    frontendEmailVerification: {
      findUnique: mocks.findVerification,
      create: mocks.createVerification,
      updateMany: mocks.updateManyVerifications,
      update: mocks.updateVerification,
      delete: mocks.deleteVerification,
      deleteMany: mocks.deleteManyVerifications,
    },
    $transaction: mocks.transaction,
  },
}));

vi.mock('../lib/emailVerification', () => ({
  emailVerificationLimits: {
    lifetimeMs: 10 * 60 * 1000,
    resendCooldownMs: 60 * 1000,
    maxAttempts: 5,
  },
  isEmailDeliveryConfigured: mocks.emailConfigured,
  sendSignupVerificationEmail: mocks.sendEmail,
}));

vi.mock('../lib/googleIdentity', () => ({
  verifyGoogleIdentity: mocks.verifyGoogle,
}));

vi.mock('bcrypt', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('hashed-password'),
    compare: vi.fn(),
  },
}));

import frontendAuthRouter from './frontendAuth';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/public-auth', frontendAuthRouter);
  return app;
}

const registration = {
  name: 'Test User',
  email: 'test@example.com',
  phone: '+94771234567',
  password: 'Testpass123',
  confirmPassword: 'Testpass123',
};

const testUser = {
  id: 'frontend-user-1',
  name: registration.name,
  email: registration.email,
  phone: registration.phone,
  avatarUrl: null,
  active: true,
  googleId: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.JWT_SECRET = 'test-jwt-secret-for-auth-tests';
  process.env.SMTP_USER = 'sender@example.com';
  process.env.SMTP_PASS = 'test-only-password';
  process.env.GOOGLE_CLIENT_ID = 'test-client-id';
  mocks.findUser.mockResolvedValue(null);
  mocks.findVerification.mockResolvedValue(null);
  mocks.createVerification.mockResolvedValue({});
  mocks.updateManyVerifications.mockResolvedValue({ count: 1 });
  mocks.sendEmail.mockResolvedValue(undefined);
  mocks.emailConfigured.mockReturnValue(true);
  mocks.deleteVerification.mockResolvedValue({});
  mocks.deleteManyVerifications.mockResolvedValue({ count: 1 });
});

describe('public account email verification', () => {
  it('sends an OTP without exposing it in the response', async () => {
    const app = createApp();
    const response = await request(app)
      .post('/api/public-auth/register/request-code')
      .send(registration);

    expect(response.status).toBe(202);
    expect(response.body.message).toMatch(/Verification code sent/);
    expect(response.body).not.toHaveProperty('code');
    expect(mocks.sendEmail).toHaveBeenCalledOnce();
    expect(mocks.sendEmail.mock.calls[0][0]).toBe(registration.email);
    expect(mocks.sendEmail.mock.calls[0][2]).toMatch(/^\d{6}$/);
    expect(mocks.createVerification).toHaveBeenCalledOnce();
    expect(mocks.createUser).not.toHaveBeenCalled();
  });

  it('does not send an OTP when SMTP credentials are missing', async () => {
    mocks.emailConfigured.mockReturnValue(false);
    const response = await request(createApp())
      .post('/api/public-auth/register/request-code')
      .send(registration);

    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe('EMAIL_NOT_CONFIGURED');
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it('enforces the resend cooldown for an email address', async () => {
    mocks.findVerification.mockResolvedValue({
      lastSentAt: new Date(),
    });
    const response = await request(createApp())
      .post('/api/public-auth/register/request-code')
      .send(registration);

    expect(response.status).toBe(429);
    expect(response.body.error.code).toBe('RESEND_COOLDOWN');
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it('creates and signs in a user only after the emailed OTP is verified', async () => {
    const code = '042713';
    const codeHash = await import('crypto').then(({ default: crypto }) =>
      crypto.createHmac('sha256', process.env.JWT_SECRET!).update(`${registration.email}:${code}`).digest('hex'));
    mocks.findVerification.mockResolvedValue({
      email: registration.email,
      codeHash,
      expiresAt: new Date(Date.now() + 60_000),
      attempts: 0,
    });
    mocks.updateVerification.mockResolvedValue({ attempts: 1 });
    mocks.transaction.mockImplementation(async (callback) => callback({
      frontendUser: { create: mocks.createUser },
      frontendEmailVerification: { delete: mocks.deleteVerification },
    }));
    mocks.createUser.mockResolvedValue(testUser);

    const response = await request(createApp())
      .post('/api/public-auth/register/verify-code')
      .send({ ...registration, verificationCode: code });

    expect(response.status).toBe(201);
    expect(response.body.token).toEqual(expect.any(String));
    expect(response.body.user.email).toBe(registration.email);
    expect(mocks.createUser).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ email: registration.email, emailVerified: true }),
    }));
    expect(mocks.deleteVerification).toHaveBeenCalledWith({ where: { email: registration.email } });
  });

  it('does not create an account when the OTP is incorrect', async () => {
    mocks.findVerification.mockResolvedValue({
      email: registration.email,
      codeHash: '0'.repeat(64),
      expiresAt: new Date(Date.now() + 60_000),
      attempts: 0,
    });

    const response = await request(createApp())
      .post('/api/public-auth/register/verify-code')
      .send({ ...registration, verificationCode: '111111' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_CODE');
    expect(mocks.updateVerification).toHaveBeenCalledWith({
      where: { email: registration.email },
      data: { attempts: { increment: 1 } },
    });
    expect(mocks.createUser).not.toHaveBeenCalled();
  });

  it('invalidates an OTP after the maximum number of incorrect attempts', async () => {
    mocks.findVerification.mockResolvedValue({
      email: registration.email,
      codeHash: '0'.repeat(64),
      expiresAt: new Date(Date.now() + 60_000),
      attempts: 4,
    });
    mocks.updateVerification.mockResolvedValue({ attempts: 5 });

    const response = await request(createApp())
      .post('/api/public-auth/register/verify-code')
      .send({ ...registration, verificationCode: '111111' });

    expect(response.status).toBe(429);
    expect(response.body.error.code).toBe('TOO_MANY_CODE_ATTEMPTS');
    expect(mocks.deleteManyVerifications).toHaveBeenCalledWith({ where: { email: registration.email } });
    expect(mocks.createUser).not.toHaveBeenCalled();
  });

  it('rejects expired OTPs and removes them', async () => {
    mocks.findVerification.mockResolvedValue({
      email: registration.email,
      codeHash: '0'.repeat(64),
      expiresAt: new Date(Date.now() - 1),
      attempts: 0,
    });

    const response = await request(createApp())
      .post('/api/public-auth/register/verify-code')
      .send({ ...registration, verificationCode: '111111' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('CODE_EXPIRED');
    expect(mocks.deleteVerification).toHaveBeenCalledWith({ where: { email: registration.email } });
  });
});

describe('Google sign-in', () => {
  it('verifies the Google identity before creating the frontend account', async () => {
    const identity = {
      googleId: 'google-subject-1',
      email: registration.email,
      name: registration.name,
      avatarUrl: 'https://example.com/avatar.png',
    };
    mocks.verifyGoogle.mockResolvedValue(identity);
    mocks.findUser.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    mocks.createUser.mockResolvedValue({ ...testUser, googleId: identity.googleId });

    const response = await request(createApp())
      .post('/api/public-auth/google')
      .send({ credential: 'signed-google-id-token' });

    expect(response.status).toBe(200);
    expect(response.body.user.email).toBe(identity.email);
    expect(mocks.verifyGoogle).toHaveBeenCalledWith('signed-google-id-token');
    expect(mocks.createUser).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        email: identity.email,
        googleId: identity.googleId,
        emailVerified: true,
      }),
    }));
  });

  it('rejects an unverified Google identity', async () => {
    mocks.verifyGoogle.mockResolvedValue(null);
    const response = await request(createApp())
      .post('/api/public-auth/google')
      .send({ credential: 'invalid-google-id-token' });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('INVALID_GOOGLE_CREDENTIAL');
    expect(mocks.createUser).not.toHaveBeenCalled();
  });

  it('reports Google provider outages separately from invalid credentials', async () => {
    mocks.verifyGoogle.mockRejectedValue(new Error('Google key service unavailable'));
    const response = await request(createApp())
      .post('/api/public-auth/google')
      .send({ credential: 'signed-google-id-token' });

    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe('GOOGLE_VERIFICATION_UNAVAILABLE');
    expect(mocks.createUser).not.toHaveBeenCalled();
  });
});
