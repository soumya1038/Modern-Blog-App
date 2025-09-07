import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import sgMail from '@sendgrid/mail';

const redis = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379');

sgMail.setApiKey(process.env.SENDGRID_API_KEY || '');

export const emailQueue = new Queue('email', { connection: redis });

interface EmailJob {
  to: string;
  subject: string;
  html: string;
}

const emailWorker = new Worker('email', async (job) => {
  const { to, subject, html } = job.data as EmailJob;
  
  await sgMail.send({
    to,
    from: process.env.SENDGRID_FROM_EMAIL || 'noreply@yourdomain.com',
    subject,
    html,
  });
  
  console.log(`Email sent to ${to}`);
}, { connection: redis });

export const queueVerificationEmail = async (email: string, token: string) => {
  const verifyUrl = `${process.env.NEXTAUTH_URL}/verify-email?token=${token}`;
  
  await emailQueue.add('verification', {
    to: email,
    subject: 'Verify your email address',
    html: `
      <h2>Verify your email</h2>
      <p>Click the link below to verify your email address:</p>
      <a href="${verifyUrl}" style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
        Verify Email
      </a>
      <p>This link expires in 10 minutes.</p>
      <p>If you didn't create an account, ignore this email.</p>
    `,
  }, {
    delay: 0,
    removeOnComplete: 10,
    removeOnFail: 5,
  });
};