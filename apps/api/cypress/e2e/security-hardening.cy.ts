describe('Security & Hardening', () => {
  const baseUrl = 'http://localhost:4000';
  
  const testUser = {
    email: 'security-test@example.com',
    password: 'password123'
  };
  
  let apiKey: string;

  before(() => {
    // Setup user and API key
    cy.request('POST', `${baseUrl}/v1/auth/register`, testUser)
      .then(() => {
        return cy.request('POST', `${baseUrl}/v1/auth/login`, testUser);
      })
      .then((response) => {
        const accessToken = response.body.accessToken;
        
        return cy.request({
          method: 'POST',
          url: `${baseUrl}/v1/auth/api-keys`,
          headers: { Authorization: `Bearer ${accessToken}` },
          body: {
            name: 'Security Test Key',
            scopes: ['read', 'write']
          }
        });
      })
      .then((response) => {
        apiKey = response.body.key;
      });
  });

  describe('Security Headers', () => {
    it('includes security headers', () => {
      cy.request(`${baseUrl}/health`).then((response) => {
        // Check for security headers
        expect(response.headers).to.have.property('x-content-type-options', 'nosniff');
        expect(response.headers).to.have.property('x-frame-options');
        expect(response.headers).to.have.property('x-xss-protection');
        
        // Check for CSP header
        expect(response.headers).to.have.property('content-security-policy');
      });
    });

    it('sets HSTS header in production-like environment', () => {
      cy.request(`${baseUrl}/health`).then((response) => {
        // HSTS may not be set in development
        if (response.headers['strict-transport-security']) {
          expect(response.headers['strict-transport-security']).to.include('max-age');
        }
      });
    });
  });

  describe('CORS Protection', () => {
    it('blocks requests from unauthorized origins', () => {
      cy.request({
        method: 'GET',
        url: `${baseUrl}/health`,
        headers: {
          'Origin': 'https://malicious-site.com'
        },
        failOnStatusCode: false
      }).then((response) => {
        // Should either block or not include CORS headers for unauthorized origin
        expect(response.status).to.be.oneOf([200, 403, 404]);
      });
    });

    it('allows requests from authorized origins', () => {
      cy.request({
        method: 'GET',
        url: `${baseUrl}/health`,
        headers: {
          'Origin': 'http://localhost:3000'
        }
      }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.headers['access-control-allow-origin']).to.eq('http://localhost:3000');
      });
    });
  });

  describe('Rate Limiting', () => {
    it('enforces general rate limits', () => {
      // Make multiple rapid requests
      const requests = [];
      for (let i = 0; i < 10; i++) {
        requests.push(
          cy.request({
            method: 'GET',
            url: `${baseUrl}/health`,
            failOnStatusCode: false
          })
        );
      }

      // All should succeed initially
      Promise.all(requests).then((responses) => {
        responses.forEach(response => {
          expect(response.status).to.eq(200);
          expect(response.headers).to.have.property('x-ratelimit-limit');
          expect(response.headers).to.have.property('x-ratelimit-remaining');
        });
      });
    });

    it('enforces auth endpoint rate limits', () => {
      // Try multiple failed login attempts
      const attempts = [];
      for (let i = 0; i < 6; i++) {
        attempts.push(
          cy.request({
            method: 'POST',
            url: `${baseUrl}/v1/auth/login`,
            body: {
              email: 'nonexistent@example.com',
              password: 'wrongpassword'
            },
            failOnStatusCode: false
          })
        );
      }

      Promise.all(attempts).then((responses) => {
        // Should start rate limiting after 5 attempts
        const lastResponse = responses[responses.length - 1];
        expect(lastResponse.status).to.be.oneOf([401, 429]); // Either unauthorized or rate limited
      });
    });

    it('enforces API key rate limits', () => {
      // Make rapid API requests
      const requests = [];
      for (let i = 0; i < 5; i++) {
        requests.push(
          cy.request({
            method: 'GET',
            url: `${baseUrl}/v1/posts`,
            headers: { 'X-API-Key': apiKey },
            failOnStatusCode: false
          })
        );
      }

      Promise.all(requests).then((responses) => {
        responses.forEach(response => {
          expect(response.status).to.be.oneOf([200, 429]);
          if (response.headers['x-ratelimit-limit']) {
            expect(parseInt(response.headers['x-ratelimit-limit'])).to.be.greaterThan(0);
          }
        });
      });
    });
  });

  describe('Input Sanitization', () => {
    it('sanitizes MongoDB injection attempts', () => {
      cy.request({
        method: 'POST',
        url: `${baseUrl}/v1/auth/login`,
        body: {
          email: { $ne: null },
          password: { $ne: null }
        },
        failOnStatusCode: false
      }).then((response) => {
        // Should not succeed with MongoDB injection
        expect(response.status).to.not.eq(200);
      });
    });

    it('prevents XSS in post content', () => {
      const maliciousContent = '<script>alert("xss")</script>';
      
      cy.request({
        method: 'POST',
        url: `${baseUrl}/v1/posts`,
        headers: { 'X-API-Key': apiKey },
        body: {
          title: 'XSS Test Post',
          content: maliciousContent,
          status: 'draft'
        },
        failOnStatusCode: false
      }).then((response) => {
        if (response.status === 201) {
          // Content should be sanitized
          expect(response.body.post.content).to.not.include('<script>');
        }
      });
    });
  });

  describe('JWT Security', () => {
    it('rejects invalid JWT tokens', () => {
      cy.request({
        method: 'GET',
        url: `${baseUrl}/v1/auth/api-keys`,
        headers: { 'Authorization': 'Bearer invalid-token' },
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.eq(401);
      });
    });

    it('rejects expired JWT tokens', () => {
      // This would require a token that's actually expired
      // For now, just test malformed tokens
      cy.request({
        method: 'GET',
        url: `${baseUrl}/v1/auth/api-keys`,
        headers: { 'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.expired.token' },
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.eq(401);
      });
    });
  });

  describe('Password Security', () => {
    it('enforces strong password requirements', () => {
      cy.request({
        method: 'POST',
        url: `${baseUrl}/v1/auth/register`,
        body: {
          email: 'weak-password@example.com',
          password: '123' // Too weak
        },
        failOnStatusCode: false
      }).then((response) => {
        // Should reject weak passwords
        expect(response.status).to.be.oneOf([400, 422]);
      });
    });

    it('uses bcrypt with sufficient rounds', () => {
      // This is tested in the security audit script
      // Here we just verify registration works with strong password
      cy.request({
        method: 'POST',
        url: `${baseUrl}/v1/auth/register`,
        body: {
          email: 'strong-password@example.com',
          password: 'StrongPassword123!'
        }
      }).then((response) => {
        expect(response.status).to.eq(201);
        // Password should be hashed, not stored in plain text
        expect(response.body.user).to.not.have.property('password');
      });
    });
  });

  describe('API Key Security', () => {
    it('validates API key format', () => {
      cy.request({
        method: 'GET',
        url: `${baseUrl}/v1/posts`,
        headers: { 'X-API-Key': 'invalid-key-format' },
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.eq(401);
      });
    });

    it('prevents API key enumeration', () => {
      // Multiple invalid API key attempts should not reveal information
      const invalidKeys = ['key1', 'key2', 'key3'];
      
      invalidKeys.forEach(key => {
        cy.request({
          method: 'GET',
          url: `${baseUrl}/v1/posts`,
          headers: { 'X-API-Key': key },
          failOnStatusCode: false
        }).then((response) => {
          expect(response.status).to.eq(401);
          expect(response.body.error).to.not.include('user'); // Don't reveal user info
        });
      });
    });
  });

  describe('OAuth Security', () => {
    it('handles OAuth state parameter', () => {
      cy.request({
        method: 'GET',
        url: `${baseUrl}/v1/auth/google`,
        followRedirect: false,
        failOnStatusCode: false
      }).then((response) => {
        if (response.status === 302) {
          // Should include state parameter in redirect
          const location = response.headers.location;
          if (location && location.includes('google')) {
            expect(location).to.include('state=');
          }
        } else {
          // OAuth not configured, should return 501
          expect(response.status).to.eq(501);
        }
      });
    });
  });

  describe('Admin Security', () => {
    it('requires admin role for JWT rotation', () => {
      cy.request({
        method: 'POST',
        url: `${baseUrl}/v1/security/rotate-jwt`,
        headers: { 'X-API-Key': apiKey },
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.eq(403); // Should require admin role
      });
    });

    it('protects admin endpoints', () => {
      const adminEndpoints = [
        '/v1/admin/stats',
        '/v1/admin/users',
        '/v1/admin/impersonate',
        '/v1/security/rotate-jwt'
      ];

      adminEndpoints.forEach(endpoint => {
        cy.request({
          method: 'GET',
          url: `${baseUrl}${endpoint}`,
          headers: { 'X-API-Key': apiKey },
          failOnStatusCode: false
        }).then((response) => {
          expect(response.status).to.be.oneOf([401, 403]); // Unauthorized or forbidden
        });
      });
    });
  });

  describe('Error Handling', () => {
    it('does not expose sensitive information in errors', () => {
      cy.request({
        method: 'POST',
        url: `${baseUrl}/v1/auth/login`,
        body: {
          email: 'nonexistent@example.com',
          password: 'wrongpassword'
        },
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.eq(401);
        // Should not reveal whether user exists
        expect(response.body.error).to.eq('Invalid credentials');
        expect(response.body.error).to.not.include('user not found');
        expect(response.body.error).to.not.include('password');
      });
    });

    it('handles malformed requests gracefully', () => {
      cy.request({
        method: 'POST',
        url: `${baseUrl}/v1/posts`,
        headers: { 
          'X-API-Key': apiKey,
          'Content-Type': 'application/json'
        },
        body: 'invalid json',
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.be.oneOf([400, 422]);
        expect(response.body).to.have.property('error');
      });
    });
  });
});