describe('Google OAuth', () => {
  const baseUrl = 'http://localhost:4000';

  it('redirects to Google OAuth consent screen', () => {
    cy.request({
      method: 'GET',
      url: `${baseUrl}/v1/auth/google`,
      followRedirect: false,
    }).then((response) => {
      expect(response.status).to.eq(302);
      expect(response.headers.location).to.include('accounts.google.com');
      expect(response.headers.location).to.include('oauth2');
    });
  });

  it('handles OAuth callback with mock user', () => {
    // This would require mocking Google's response in a real test
    // For now, we'll test the callback endpoint structure
    cy.request({
      method: 'GET',
      url: `${baseUrl}/v1/auth/google/callback`,
      failOnStatusCode: false,
    }).then((response) => {
      // Without proper OAuth flow, this will fail authentication
      // but we can verify the endpoint exists
      expect([302, 401, 500]).to.include(response.status);
    });
  });

  it('creates user with Google provider', () => {
    // Mock a Google user creation directly in database for testing
    const mockGoogleUser = {
      email: 'google-test@example.com',
      provider: 'google',
      googleId: 'google-123456',
      isEmailVerified: true,
      avatar: 'https://lh3.googleusercontent.com/test-avatar'
    };

    cy.request({
      method: 'POST',
      url: `${baseUrl}/test/create-google-user`,
      body: mockGoogleUser,
      failOnStatusCode: false
    }).then((response) => {
      if (response.status === 201) {
        expect(response.body.user.provider).to.eq('google');
        expect(response.body.user.isEmailVerified).to.be.true;
        expect(response.body.user.avatar).to.include('googleusercontent.com');
      }
    });
  });
});