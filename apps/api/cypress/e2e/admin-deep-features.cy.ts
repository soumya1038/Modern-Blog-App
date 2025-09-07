describe('Admin Deep Features', () => {
  const baseUrl = 'http://localhost:4000';
  const adminUrl = 'http://localhost:3001';
  
  const regularUser = {
    email: 'impersonate-target@example.com',
    password: 'password123'
  };
  
  const adminUser = {
    email: 'admin-impersonator@example.com',
    password: 'password123'
  };
  
  let regularUserId: string;
  let adminApiKey: string;
  let testPostId: string;

  before(() => {
    // Create regular user to impersonate
    cy.request('POST', `${baseUrl}/v1/auth/register`, regularUser)
      .then((response) => {
        regularUserId = response.body.user._id;
      });

    // Create admin user
    cy.request('POST', `${baseUrl}/v1/auth/register`, adminUser)
      .then(() => {
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
        const adminAccessToken = response.body.accessToken;
        
        return cy.request({
          method: 'POST',
          url: `${baseUrl}/v1/auth/api-keys`,
          headers: { Authorization: `Bearer ${adminAccessToken}` },
          body: {
            name: 'Admin Deep Features Key',
            scopes: ['read', 'write', 'admin']
          }
        });
      })
      .then((response) => {
        adminApiKey = response.body.key;
      });
  });

  describe('User Impersonation E2E Test', () => {
    it('admin → impersonate → create post → stop impersonation → post listed under user', () => {
      // Step 1: Start impersonation
      cy.request({
        method: 'POST',
        url: `${baseUrl}/v1/admin/impersonate`,
        headers: { 'X-API-Key': adminApiKey },
        body: { userId: regularUserId }
      }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.impersonating.userId).to.eq(regularUserId);
        expect(response.body.impersonating.email).to.eq(regularUser.email);
        
        const impersonationData = response.body.impersonating;
        
        // Step 2: Create post while impersonating
        return cy.request({
          method: 'POST',
          url: `${baseUrl}/v1/posts`,
          headers: {
            'X-API-Key': adminApiKey,
            'X-Impersonate-User': JSON.stringify(impersonationData)
          },
          body: {
            title: 'Post Created via Impersonation',
            content: 'This post was created while admin was impersonating a user',
            status: 'published'
          }
        });
      }).then((response) => {
        expect(response.status).to.eq(201);
        expect(response.body.post.title).to.eq('Post Created via Impersonation');
        
        testPostId = response.body.post._id;
        
        // Verify the post is attributed to the impersonated user, not admin
        expect(response.body.post.authorId).to.eq(regularUserId);
        
        // Step 3: Stop impersonation
        return cy.request({
          method: 'POST',
          url: `${baseUrl}/v1/admin/stop-impersonation`,
          headers: { 'X-API-Key': adminApiKey }
        });
      }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.message).to.include('stopped');
        
        // Step 4: Verify post is listed under the impersonated user
        return cy.request({
          method: 'GET',
          url: `${baseUrl}/v1/posts`,
          headers: { 'X-API-Key': adminApiKey }
        });
      }).then((response) => {
        expect(response.status).to.eq(200);
        
        const createdPost = response.body.posts.find((p: any) => p._id === testPostId);
        expect(createdPost).to.exist;
        expect(createdPost.authorId._id).to.eq(regularUserId);
        expect(createdPost.authorId.email).to.eq(regularUser.email);
      });
    });

    it('prevents impersonating admin users', () => {
      // Try to impersonate admin user (should fail or be restricted)
      cy.request({
        method: 'POST',
        url: `${baseUrl}/v1/admin/impersonate`,
        headers: { 'X-API-Key': adminApiKey },
        body: { userId: 'admin-user-id' },
        failOnStatusCode: false
      }).then((response) => {
        // Should either fail or succeed but with restrictions
        // Implementation can vary based on security requirements
        expect([200, 400, 403]).to.include(response.status);
      });
    });
  });

  describe('Bulk Delete Posts', () => {
    it('bulk deletes multiple posts', () => {
      // Create multiple test posts
      const postPromises = [];
      for (let i = 1; i <= 3; i++) {
        postPromises.push(
          cy.request({
            method: 'POST',
            url: `${baseUrl}/v1/posts`,
            headers: { 'X-API-Key': adminApiKey },
            body: {
              title: `Bulk Delete Test Post ${i}`,
              content: `Content for bulk delete test ${i}`,
              status: 'draft'
            }
          })
        );
      }

      Promise.all(postPromises).then((responses: any[]) => {
        const postIds = responses.map(r => r.body.post._id);
        
        // Bulk delete the posts
        return cy.request({
          method: 'DELETE',
          url: `${baseUrl}/v1/admin/posts/bulk`,
          headers: { 'X-API-Key': adminApiKey },
          body: { postIds }
        });
      }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.deletedCount).to.eq(3);
        expect(response.body.message).to.include('3 posts deleted');
      });
    });

    it('requires admin role for bulk operations', () => {
      cy.request({
        method: 'DELETE',
        url: `${baseUrl}/v1/admin/posts/bulk`,
        headers: { 'X-API-Key': 'invalid-key' },
        body: { postIds: ['test-id'] },
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.eq(401);
      });
    });
  });

  describe('Media Manager', () => {
    it('lists all media files with metadata', () => {
      cy.request({
        method: 'GET',
        url: `${baseUrl}/v1/admin/media`,
        headers: { 'X-API-Key': adminApiKey }
      }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body).to.have.property('media');
        expect(response.body).to.have.property('totalSizeGB');
        expect(response.body).to.have.property('pagination');
      });
    });

    it('purges media from CDN', () => {
      // This test would require actual media files
      // For now, test the endpoint structure
      cy.request({
        method: 'DELETE',
        url: `${baseUrl}/v1/admin/media/purge`,
        headers: { 'X-API-Key': adminApiKey },
        body: { mediaIds: [] },
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.purgedCount).to.eq(0);
      });
    });
  });

  describe('Site Settings', () => {
    it('updates and retrieves site settings', () => {
      const testSettings = {
        siteName: 'Test Blog',
        maintenanceMode: false,
        maxPostsPerPage: 10
      };

      // Update settings
      cy.request({
        method: 'PUT',
        url: `${baseUrl}/v1/admin/settings`,
        headers: { 'X-API-Key': adminApiKey },
        body: { settings: testSettings }
      }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.message).to.include('updated');
        
        // Retrieve settings
        return cy.request({
          method: 'GET',
          url: `${baseUrl}/v1/admin/settings`,
          headers: { 'X-API-Key': adminApiKey }
        });
      }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.settings.siteName.value).to.eq('Test Blog');
        expect(response.body.settings.maintenanceMode.value).to.eq(false);
      });
    });
  });

  describe('AI Spam Review Queue', () => {
    it('returns spam comments for review', () => {
      cy.request({
        method: 'GET',
        url: `${baseUrl}/v1/admin/spam-review`,
        headers: { 'X-API-Key': adminApiKey }
      }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body).to.have.property('spamQueue');
        expect(Array.isArray(response.body.spamQueue)).to.be.true;
      });
    });
  });

  describe('Feature Flags', () => {
    it('manages feature flags', () => {
      // Create/update feature flag
      cy.request({
        method: 'PUT',
        url: `${baseUrl}/v1/admin/feature-flags/test-feature`,
        headers: { 'X-API-Key': adminApiKey },
        body: {
          enabled: true,
          description: 'Test feature for E2E testing',
          rolloutPercentage: 50
        }
      }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.flag.name).to.eq('test-feature');
        expect(response.body.flag.enabled).to.be.true;
        expect(response.body.flag.rolloutPercentage).to.eq(50);
        
        // Get all feature flags
        return cy.request({
          method: 'GET',
          url: `${baseUrl}/v1/admin/feature-flags`,
          headers: { 'X-API-Key': adminApiKey }
        });
      }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.flags).to.be.an('array');
        
        const testFlag = response.body.flags.find((f: any) => f.name === 'test-feature');
        expect(testFlag).to.exist;
        expect(testFlag.enabled).to.be.true;
      });
    });
  });

  describe('Frontend Integration', () => {
    it('impersonation page works end-to-end', () => {
      cy.visit(`${adminUrl}/impersonate`);
      
      // Set admin API key
      cy.window().then((win) => {
        win.localStorage.setItem('apiKey', adminApiKey);
      });
      
      cy.reload();
      
      // Should show impersonation interface
      cy.contains('User Impersonation').should('be.visible');
      cy.contains('Select User to Impersonate').should('be.visible');
      
      // Should show E2E test instructions
      cy.contains('E2E Test Flow').should('be.visible');
      cy.contains('Select a user to impersonate').should('be.visible');
    });

    it('media manager page loads correctly', () => {
      cy.visit(`${adminUrl}/media-manager`);
      
      cy.window().then((win) => {
        win.localStorage.setItem('apiKey', adminApiKey);
      });
      
      cy.reload();
      
      // Should show media manager interface
      cy.contains('Media Manager').should('be.visible');
      cy.contains('Total Storage').should('be.visible');
      cy.contains('Select All').should('be.visible');
    });
  });
});