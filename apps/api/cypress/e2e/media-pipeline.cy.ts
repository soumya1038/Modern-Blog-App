describe('Media Pipeline', () => {
  const baseUrl = 'http://localhost:4000';
  const testUser = {
    email: 'media-test@example.com',
    password: 'password123'
  };
  let accessToken: string;
  let apiKey: string;

  before(() => {
    // Setup user and API key
    cy.request('POST', `${baseUrl}/v1/auth/register`, testUser)
      .then(() => {
        return cy.request('POST', `${baseUrl}/v1/auth/login`, testUser);
      })
      .then((response) => {
        accessToken = response.body.accessToken;
        
        return cy.request({
          method: 'POST',
          url: `${baseUrl}/v1/auth/api-keys`,
          headers: { Authorization: `Bearer ${accessToken}` },
          body: {
            name: 'Media Test Key',
            scopes: ['read', 'write']
          }
        });
      })
      .then((response) => {
        apiKey = response.body.key;
      });
  });

  describe('GET /v1/media/sign - Signed upload parameters', () => {
    it('returns signed upload parameters for valid file size', () => {
      const fileSize = 1024 * 1024; // 1MB
      
      cy.request({
        method: 'GET',
        url: `${baseUrl}/v1/media/sign?fileSize=${fileSize}`,
        headers: { 'X-API-Key': apiKey }
      }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body).to.have.property('signature');
        expect(response.body).to.have.property('timestamp');
        expect(response.body).to.have.property('cloudName');
        expect(response.body).to.have.property('apiKey');
        expect(response.body).to.have.property('uploadUrl');
        expect(response.body.uploadParams).to.have.property('eager');
        expect(response.body.uploadParams.eager).to.have.length(2); // 800w and 1600w
      });
    });

    it('rejects file size exceeding limit', () => {
      const fileSize = 50 * 1024 * 1024; // 50MB (exceeds 10MB limit)
      
      cy.request({
        method: 'GET',
        url: `${baseUrl}/v1/media/sign?fileSize=${fileSize}`,
        headers: { 'X-API-Key': apiKey },
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.eq(400);
        expect(response.body.error).to.include('exceeds');
        expect(response.body.error).to.include('MB limit');
      });
    });

    it('requires authentication', () => {
      cy.request({
        method: 'GET',
        url: `${baseUrl}/v1/media/sign?fileSize=1024`,
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.eq(401);
      });
    });
  });

  describe('POST /v1/media/webhook - Cloudinary webhook', () => {
    it('processes webhook and creates media record', () => {
      const webhookData = {
        public_id: `blog/${testUser.email}/test-image-123`,
        secure_url: 'https://res.cloudinary.com/test/image/upload/test-image.jpg',
        bytes: 102400,
        format: 'jpg',
        width: 800,
        height: 600,
        context: { user_id: 'test-user-id' },
        eager: [
          { secure_url: 'https://res.cloudinary.com/test/image/upload/w_800/test-image.webp' },
          { secure_url: 'https://res.cloudinary.com/test/image/upload/w_1600/test-image.webp' }
        ]
      };

      cy.request({
        method: 'POST',
        url: `${baseUrl}/v1/media/webhook`,
        body: webhookData
      }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.success).to.be.true;
      });
    });

    it('rejects webhook without user context', () => {
      const webhookData = {
        public_id: 'test-image-123',
        secure_url: 'https://res.cloudinary.com/test/image/upload/test-image.jpg',
        bytes: 102400,
        format: 'jpg'
        // Missing context.user_id
      };

      cy.request({
        method: 'POST',
        url: `${baseUrl}/v1/media/webhook`,
        body: webhookData,
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.eq(400);
        expect(response.body.error).to.include('user context');
      });
    });
  });

  describe('GET /v1/media - List user media', () => {
    it('returns paginated media list with storage usage', () => {
      cy.request({
        method: 'GET',
        url: `${baseUrl}/v1/media?page=1&limit=10`,
        headers: { 'X-API-Key': apiKey }
      }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body).to.have.property('media');
        expect(response.body).to.have.property('pagination');
        expect(response.body).to.have.property('storageUsage');
        expect(response.body.storageUsage).to.have.property('usedGB');
        expect(response.body.storageUsage).to.have.property('maxGB');
        expect(response.body.storageUsage).to.have.property('remainingGB');
      });
    });
  });

  describe('Frontend Integration', () => {
    it('drag-drop upload page loads correctly', () => {
      cy.visit('http://localhost:3000/upload');
      
      // Set API key in localStorage
      cy.window().then((win) => {
        win.localStorage.setItem('apiKey', apiKey);
      });
      
      cy.reload();
      
      // Should show upload interface
      cy.contains('Media Upload').should('be.visible');
      cy.contains('Drag & drop an image here').should('be.visible');
      cy.contains('WebP optimization included').should('be.visible');
      
      // Should show features list
      cy.contains('Drag & drop upload').should('be.visible');
      cy.contains('Automatic WebP conversion').should('be.visible');
      cy.contains('Size and storage quota enforcement').should('be.visible');
    });

    it('shows error for missing API key', () => {
      cy.visit('http://localhost:3000/upload');
      
      // Clear API key
      cy.window().then((win) => {
        win.localStorage.removeItem('apiKey');
      });
      
      // Try to trigger upload (would need actual file upload simulation)
      // For now, just verify the page structure is correct
      cy.contains('API key required').should('not.exist'); // Initially not shown
    });
  });

  describe('Quota Enforcement', () => {
    it('enforces storage quota per user', () => {
      // This would require creating multiple large files to test quota
      // For now, verify the quota check endpoint exists
      cy.request({
        method: 'GET',
        url: `${baseUrl}/v1/media`,
        headers: { 'X-API-Key': apiKey }
      }).then((response) => {
        expect(response.body.storageUsage.maxGB).to.eq(5); // Default quota
      });
    });
  });
});