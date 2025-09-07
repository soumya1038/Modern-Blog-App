describe('Universal Auth Middleware', () => {
  const baseUrl = 'http://localhost:4000';
  const testUser = {
    email: 'universal-test@example.com',
    password: 'password123'
  };
  const adminUser = {
    email: 'admin-test@example.com',
    password: 'password123'
  };
  
  let userAccessToken: string;
  let adminAccessToken: string;
  let userApiKey: string;
  let adminApiKey: string;
  let postId: string;

  before(() => {
    // Create regular user
    cy.request('POST', `${baseUrl}/v1/auth/register`, testUser)
      .then(() => {
        return cy.request('POST', `${baseUrl}/v1/auth/login`, testUser);
      })
      .then((response) => {
        userAccessToken = response.body.accessToken;
        
        // Create user API key
        return cy.request({
          method: 'POST',
          url: `${baseUrl}/v1/auth/api-keys`,
          headers: { Authorization: `Bearer ${userAccessToken}` },
          body: { name: 'User Key', scopes: ['read', 'write'] }
        });
      })
      .then((response) => {
        userApiKey = response.body.key;
      });

    // Create admin user
    cy.request('POST', `${baseUrl}/v1/auth/register`, adminUser)
      .then(() => {
        // Manually set admin role in database
        return cy.request({
          method: 'POST',
          url: `${baseUrl}/test/set-admin-role`,
          body: { email: adminUser.email }
        });
      })
      .then(() => {
        return cy.request('POST', `${baseUrl}/v1/auth/login`, adminUser);
      })
      .then((response) => {
        adminAccessToken = response.body.accessToken;
        
        // Create admin API key
        return cy.request({
          method: 'POST',
          url: `${baseUrl}/v1/auth/api-keys`,
          headers: { Authorization: `Bearer ${adminAccessToken}` },
          body: { name: 'Admin Key', scopes: ['read', 'write', 'admin'] }
        });
      })
      .then((response) => {
        adminApiKey = response.body.key;
        
        // Create a test post
        return cy.request({
          method: 'POST',
          url: `${baseUrl}/v1/posts`,
          headers: { 'X-API-Key': userApiKey },
          body: {
            title: 'Test Post for Deletion',
            content: 'Test content',
            slug: 'test-post-delete'
          }
        });
      })
      .then((response) => {
        postId = response.body.post._id;
      });
  });

  describe('GET /v1/posts - All auth methods work', () => {
    it('works with JWT cookie', () => {
      cy.request({
        method: 'GET',
        url: `${baseUrl}/v1/posts`,
        headers: { Authorization: `Bearer ${userAccessToken}` }
      }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.posts).to.be.an('array');
      });
    });

    it('works with API key', () => {
      cy.request({
        method: 'GET',
        url: `${baseUrl}/v1/posts`,
        headers: { 'X-API-Key': userApiKey }
      }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.posts).to.be.an('array');
      });
    });

    it('fails without auth', () => {
      cy.request({
        method: 'GET',
        url: `${baseUrl}/v1/posts`,
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.eq(401);
        expect(response.body.error).to.include('Authentication required');
      });
    });
  });

  describe('DELETE /v1/posts/:id - Admin role required', () => {
    it('works with admin JWT', () => {
      cy.request({
        method: 'DELETE',
        url: `${baseUrl}/v1/posts/${postId}`,
        headers: { Authorization: `Bearer ${adminAccessToken}` }
      }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.message).to.include('deleted');
        expect(response.body.authMethod).to.eq('jwt');
      });
    });

    it('works with admin API key', () => {
      // Create another post first
      cy.request({
        method: 'POST',
        url: `${baseUrl}/v1/posts`,
        headers: { 'X-API-Key': userApiKey },
        body: {
          title: 'Another Test Post',
          content: 'Test content',
          slug: 'another-test-post'
        }
      }).then((response) => {
        const newPostId = response.body.post._id;
        
        return cy.request({
          method: 'DELETE',
          url: `${baseUrl}/v1/posts/${newPostId}`,
          headers: { 'X-API-Key': adminApiKey }
        });
      }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.message).to.include('deleted');
        expect(response.body.authMethod).to.eq('apikey');
      });
    });

    it('fails with user JWT (not admin)', () => {
      cy.request({
        method: 'DELETE',
        url: `${baseUrl}/v1/posts/${postId}`,
        headers: { Authorization: `Bearer ${userAccessToken}` },
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.eq(403);
        expect(response.body.error).to.include('Admin role required');
      });
    });

    it('fails with user API key (not admin)', () => {
      cy.request({
        method: 'DELETE',
        url: `${baseUrl}/v1/posts/${postId}`,
        headers: { 'X-API-Key': userApiKey },
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.eq(403);
        expect(response.body.error).to.include('Admin role required');
      });
    });

    it('fails without auth', () => {
      cy.request({
        method: 'DELETE',
        url: `${baseUrl}/v1/posts/${postId}`,
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.eq(401);
        expect(response.body.error).to.include('Authentication required');
      });
    });
  });
});