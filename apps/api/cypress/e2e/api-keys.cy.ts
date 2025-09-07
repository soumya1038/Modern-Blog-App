describe('API Keys', () => {
  const baseUrl = 'http://localhost:4000';
  const testUser = {
    email: 'apikey-test@example.com',
    password: 'password123'
  };
  let accessToken: string;
  let apiKey: string;

  before(() => {
    // Register and login user
    cy.request('POST', `${baseUrl}/v1/auth/register`, testUser)
      .then(() => {
        return cy.request('POST', `${baseUrl}/v1/auth/login`, testUser);
      })
      .then((response) => {
        accessToken = response.body.accessToken;
      });
  });

  it('creates API key with scopes', () => {
    cy.request({
      method: 'POST',
      url: `${baseUrl}/v1/auth/api-keys`,
      headers: { Authorization: `Bearer ${accessToken}` },
      body: {
        name: 'Test API Key',
        scopes: ['read', 'write']
      }
    }).then((response) => {
      expect(response.status).to.eq(201);
      expect(response.body).to.have.property('key');
      expect(response.body.name).to.eq('Test API Key');
      expect(response.body.scopes).to.deep.eq(['read', 'write']);
      
      apiKey = response.body.key;
      expect(apiKey).to.have.length(64); // 32 bytes hex = 64 chars
    });
  });

  it('lists API keys metadata', () => {
    cy.request({
      method: 'GET',
      url: `${baseUrl}/v1/auth/api-keys`,
      headers: { Authorization: `Bearer ${accessToken}` }
    }).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body.apiKeys).to.have.length(1);
      expect(response.body.apiKeys[0].name).to.eq('Test API Key');
      expect(response.body.apiKeys[0].scopes).to.deep.eq(['read', 'write']);
      expect(response.body.apiKeys[0]).to.not.have.property('hashedKey');
    });
  });

  it('authenticates with API key and gets posts', () => {
    // First create a test post
    cy.request({
      method: 'POST',
      url: `${baseUrl}/v1/posts`,
      headers: { 'X-API-Key': apiKey },
      body: {
        title: 'Test Post',
        content: 'Test content',
        slug: 'test-post'
      }
    }).then((response) => {
      expect(response.status).to.eq(201);
    });

    // Then fetch posts with API key (no cookie needed)
    cy.request({
      method: 'GET',
      url: `${baseUrl}/v1/posts`,
      headers: { 'X-API-Key': apiKey }
    }).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body.posts).to.be.an('array');
      expect(response.body.posts[0].title).to.eq('Test Post');
    });
  });

  it('rejects API key without required scope', () => {
    // Create read-only API key
    cy.request({
      method: 'POST',
      url: `${baseUrl}/v1/auth/api-keys`,
      headers: { Authorization: `Bearer ${accessToken}` },
      body: {
        name: 'Read Only Key',
        scopes: ['read']
      }
    }).then((response) => {
      const readOnlyKey = response.body.key;
      
      // Try to create post with read-only key
      cy.request({
        method: 'POST',
        url: `${baseUrl}/v1/posts`,
        headers: { 'X-API-Key': readOnlyKey },
        body: {
          title: 'Should Fail',
          content: 'Should fail',
          slug: 'should-fail'
        },
        failOnStatusCode: false
      }).then((postResponse) => {
        expect(postResponse.status).to.eq(403);
        expect(postResponse.body.error).to.include('write');
      });
    });
  });

  it('revokes API key', () => {
    cy.request({
      method: 'DELETE',
      url: `${baseUrl}/v1/auth/api-keys/0`,
      headers: { Authorization: `Bearer ${accessToken}` }
    }).then((response) => {
      expect(response.status).to.eq(200);
      expect(response.body.message).to.include('revoked');
    });

    // Verify revoked key no longer works
    cy.request({
      method: 'GET',
      url: `${baseUrl}/v1/posts`,
      headers: { 'X-API-Key': apiKey },
      failOnStatusCode: false
    }).then((response) => {
      expect(response.status).to.eq(401);
    });
  });
});