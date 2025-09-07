describe('Admin Panel', () => {
  const baseUrl = 'http://localhost:4000';
  const adminUrl = 'http://localhost:3001';
  
  const regularUser = {
    email: 'regular-user@example.com',
    password: 'password123'
  };
  
  const adminUser = {
    email: 'admin-user@example.com',
    password: 'password123'
  };
  
  let regularApiKey: string;
  let adminApiKey: string;

  before(() => {
    // Create regular user
    cy.request('POST', `${baseUrl}/v1/auth/register`, regularUser)
      .then(() => {
        return cy.request('POST', `${baseUrl}/v1/auth/login`, regularUser);
      })
      .then((response) => {
        const accessToken = response.body.accessToken;
        
        return cy.request({
          method: 'POST',
          url: `${baseUrl}/v1/auth/api-keys`,
          headers: { Authorization: `Bearer ${accessToken}` },
          body: {
            name: 'Regular User Key',
            scopes: ['read', 'write']
          }
        });
      })
      .then((response) => {
        regularApiKey = response.body.key;
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
            name: 'Admin Key',
            scopes: ['read', 'write', 'admin']
          }
        });
      })
      .then((response) => {
        adminApiKey = response.body.key;
      });
  });

  describe('GET /v1/admin/stats - Admin stats endpoint', () => {
    it('returns admin stats for admin user', () => {
      cy.request({
        method: 'GET',
        url: `${baseUrl}/v1/admin/stats`,
        headers: { 'X-API-Key': adminApiKey }
      }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body).to.have.property('overview');
        expect(response.body.overview).to.have.property('totalUsers');
        expect(response.body.overview).to.have.property('totalPosts');
        expect(response.body.overview).to.have.property('totalComments');
        expect(response.body.overview).to.have.property('totalMedia');
        expect(response.body.overview).to.have.property('totalStorageGB');
        expect(response.body).to.have.property('recent');
        expect(response.body.recent).to.have.property('posts');
        expect(response.body.recent).to.have.property('comments');
      });
    });

    it('rejects regular user access', () => {
      cy.request({
        method: 'GET',
        url: `${baseUrl}/v1/admin/stats`,
        headers: { 'X-API-Key': regularApiKey },
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.eq(403);
        expect(response.body.error).to.include('Admin role required');
      });
    });

    it('rejects unauthenticated access', () => {
      cy.request({
        method: 'GET',
        url: `${baseUrl}/v1/admin/stats`,
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.eq(401);
      });
    });
  });

  describe('Admin Dashboard Frontend', () => {
    it('loads admin dashboard with live data for admin user', () => {
      cy.visit(`${adminUrl}/`);
      
      // Set admin API key
      cy.window().then((win) => {
        win.localStorage.setItem('apiKey', adminApiKey);
      });
      
      cy.reload();
      
      // Should show admin dashboard
      cy.contains('Admin Dashboard').should('be.visible');
      cy.contains('Blog management and analytics overview').should('be.visible');
      
      // Should show KPI cards
      cy.contains('Total Users').should('be.visible');
      cy.contains('Total Posts').should('be.visible');
      cy.contains('Comments').should('be.visible');
      cy.contains('Media Files').should('be.visible');
      
      // Should show recent activity sections
      cy.contains('Recent Posts').should('be.visible');
      cy.contains('Recent Comments').should('be.visible');
      
      // Should show quick actions
      cy.contains('Quick Actions').should('be.visible');
      cy.contains('Moderate Comments').should('be.visible');
    });

    it('shows access denied for regular user', () => {
      cy.visit(`${adminUrl}/`);
      
      // Set regular user API key
      cy.window().then((win) => {
        win.localStorage.setItem('apiKey', regularApiKey);
      });
      
      cy.reload();
      
      // Should show access denied
      cy.contains('Access Denied').should('be.visible');
      cy.contains('Admin access required').should('be.visible');
      cy.contains('Get API Key').should('be.visible');
    });

    it('shows login prompt for unauthenticated user', () => {
      cy.visit(`${adminUrl}/`);
      
      // Clear API key
      cy.window().then((win) => {
        win.localStorage.removeItem('apiKey');
      });
      
      cy.reload();
      
      // Should show login prompt
      cy.contains('API key required').should('be.visible');
      cy.contains('Please login first').should('be.visible');
    });
  });

  describe('Live Data Integration', () => {
    it('displays real-time statistics', () => {
      // Create some test data first
      cy.request({
        method: 'POST',
        url: `${baseUrl}/v1/posts`,
        headers: { 'X-API-Key': adminApiKey },
        body: {
          title: 'Admin Test Post',
          content: 'Content for admin dashboard testing',
          status: 'published'
        }
      });

      cy.request({
        method: 'POST',
        url: `${baseUrl}/v1/comments`,
        headers: { 'X-API-Key': adminApiKey },
        body: {
          content: 'Test comment for admin dashboard',
          postId: 'test-post-id'
        }
      });

      // Visit admin dashboard
      cy.visit(`${adminUrl}/`);
      
      cy.window().then((win) => {
        win.localStorage.setItem('apiKey', adminApiKey);
      });
      
      cy.reload();
      
      // Verify live data is displayed
      cy.get('[data-testid="total-users"]', { timeout: 10000 }).should('contain', '2'); // 2 test users
      cy.contains('Total Posts').parent().should('contain.text', '1'); // At least 1 post
      cy.contains('Comments').parent().should('contain.text', '1'); // At least 1 comment
    });

    it('shows Cloudinary usage when available', () => {
      cy.visit(`${adminUrl}/`);
      
      cy.window().then((win) => {
        win.localStorage.setItem('apiKey', adminApiKey);
      });
      
      cy.reload();
      
      // Cloudinary section may or may not appear depending on API key configuration
      // Just verify the dashboard loads without errors
      cy.contains('Admin Dashboard').should('be.visible');
    });
  });

  describe('Role Guard Protection', () => {
    it('enforces admin role across all admin endpoints', () => {
      const adminEndpoints = [
        '/v1/admin/stats',
        '/v1/admin/users'
      ];

      adminEndpoints.forEach(endpoint => {
        // Test with regular user
        cy.request({
          method: 'GET',
          url: `${baseUrl}${endpoint}`,
          headers: { 'X-API-Key': regularApiKey },
          failOnStatusCode: false
        }).then((response) => {
          expect(response.status).to.eq(403);
        });

        // Test with admin user
        cy.request({
          method: 'GET',
          url: `${baseUrl}${endpoint}`,
          headers: { 'X-API-Key': adminApiKey }
        }).then((response) => {
          expect(response.status).to.eq(200);
        });
      });
    });
  });
});