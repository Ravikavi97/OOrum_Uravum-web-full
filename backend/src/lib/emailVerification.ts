import nodemailer from 'nodemailer';

const OTP_LIFETIME_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;

export const emailVerificationLimits = {
  lifetimeMs: OTP_LIFETIME_MS,
  resendCooldownMs: RESEND_COOLDOWN_MS,
  maxAttempts: MAX_OTP_ATTEMPTS,
};

export function isEmailDeliveryConfigured(): boolean {
  return Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);
}

export async function sendSignupVerificationEmail(email: string, name: string, code: string): Promise<void> {
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.replace(/\s/g, '');
  if (!user || !pass) {
    throw new Error('SMTP_USER and SMTP_PASS must be configured to send verification emails.');
  }

  const port = Number(process.env.SMTP_PORT || 465);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('SMTP_PORT must be a valid TCP port.');
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port,
    secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : port === 465,
    auth: { user, pass },
  });

  await transporter.sendMail({
    from: process.env.SMTP_FROM || `Oorum Uravum <${user}>`,
    to: email,
    subject: 'Verify your Oorum Uravum account',
    text: [
      `Hello ${name},`,
      '',
      `Your verification code is ${code}.`,
      'It expires in 10 minutes and can only be used once.',
      '',
      'If you did not request this account, you can ignore this email.',
    ].join('\n'),
  });
}
