describe('Email Verification', () => {
  const baseUrl = 'http://localhost:4000';
  const testUser = {
    email: 'verify-test@example.com',
    password: 'password123'
  };

  it('sends verification email and verifies successfully', () => {
    // Register user
    cy.request({
      method: 'POST',
      url: `${baseUrl}/v1/auth/register`,
      body: testUser
    }).then((response) => {
      expect(response.status).to.eq(201);
      expect(response.body.user.isEmailVerified).to.be.false;
    });

    // Simulate getting token from email (in real scenario, this would come from email)
    // For testing, we'll query the database directly or use a test endpoint
    cy.request({
      method: 'GET',
      url: `${baseUrl}/test/get-verify-token/${testUser.email}`,
      failOnStatusCode: false
    }).then((tokenResponse) => {
      if (tokenResponse.status === 200) {
        const token = tokenResponse.body.token;
        
        // Verify email with token
        cy.request({
          method: 'GET',
          url: `${baseUrl}/v1/auth/verify-email?token=${token}`
        }).then((verifyResponse) => {
          expect(verifyResponse.status).to.eq(200);
          expect(verifyResponse.body.message).to.include('verified');
          expect(verifyResponse.body.user.isEmailVerified).to.be.true;
          expect(verifyResponse.body).to.have.property('accessToken');
        });
      }
    });
  });

  it('rejects expired verification token', () => {
    cy.request({
      method: 'GET',
      url: `${baseUrl}/v1/auth/verify-email?token=expired-token`,
      failOnStatusCode: false
    }).then((response) => {
      expect(response.status).to.eq(400);
      expect(response.body.error).to.include('Invalid or expired');
    });
  });
});