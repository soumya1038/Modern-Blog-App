export const sendVerificationEmail = (email: string, token: string) => {
  console.log(`[MAILER STUB] Verification email for ${email}`);
  console.log(`[MAILER STUB] Token: ${token}`);
  console.log(`[MAILER STUB] Verify URL: http://localhost:3000/verify?token=${token}`);
};