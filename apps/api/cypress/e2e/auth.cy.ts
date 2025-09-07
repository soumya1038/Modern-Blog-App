describe('Auth API', () => {
  const baseUrl = 'http://localhost:4000';
  const testUser = {
    email: 'test@example.com',
    password: 'password123'
  };

  beforeEach(() => {
    // Clean up test user if exists
    cy.request({
      method: 'DELETE',
      url: `${baseUrl}/test/cleanup`,
      failOnStatusCode: false
    });
  });

  it('registers user and receives unverified JWT', () => {
    cy.request({
      method: 'POST',
      url: `${baseUrl}/v1/auth/register`,
      body: testUser
    }).then((response) => {
      expect(response.status).to.eq(201);
      expect(response.body).to.have.property('accessToken');
      expect(response.body.user).to.have.property('email', testUser.email);
      expect(response.body.user).to.have.property('isEmailVerified', false);
      
      // Verify JWT structure
      const token = response.body.accessToken;
      const payload = JSON.parse(atob(token.split('.')[1]));
      expect(payload).to.have.property('userId');
      expect(payload.exp - payload.iat).to.eq(900); // 15 minutes
    });
  });

  it('logs in existing user', () => {
    // First register
    cy.request('POST', `${baseUrl}/v1/auth/register`, testUser);
    
    // Then login
    cy.request({
      method: 'POST',
      url: `${baseUrl}/v1/auth/login`,
      body: testUser
    }).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body).to.have.property('accessToken');
      expect(response.body.user.email).to.eq(testUser.email);
    });
  });
});