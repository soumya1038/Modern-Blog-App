describe('Complete Auth Flow E2E', () => {
  const baseUrl = 'http://localhost:4000';
  const webUrl = 'http://localhost:3000';
  
  const testUser = {
    email: 'e2e-test@example.com',
    password: 'SecurePassword123!'
  };

  it('complete user journey: sign-up → verify email → create post → delete', () => {
    // Step 1: Sign up
    cy.request('POST', `${baseUrl}/v1/auth/register`, testUser)
      .then((response) => {
        expect(response.status).to.eq(201);
        expect(response.body.user.email).to.eq(testUser.email);
        expect(response.body.user.isEmailVerified).to.be.false;
        expect(response.body.accessToken).to.exist;
        
        // Store access token for later use
        cy.wrap(response.body.accessToken).as('accessToken');
      });

    // Step 2: Verify email (simulate clicking verification link)
    cy.get('@accessToken').then((accessToken) => {
      // Create a verification token (in real scenario, this would come from email)
      cy.request({
        method: 'POST',
        url: `${baseUrl}/test/create-verify-token`,
        body: { email: testUser.email }
      }).then((tokenResponse) => {
        const verifyToken = tokenResponse.body.token;
        
        // Verify email
        return cy.request(`${baseUrl}/v1/auth/verify-email?token=${verifyToken}`);
      }).then((verifyResponse) => {
        expect(verifyResponse.status).to.eq(200);
        expect(verifyResponse.body.user.isEmailVerified).to.be.true;
        expect(verifyResponse.body.message).to.include('verified');
      });
    });

    // Step 3: Login after verification
    cy.request('POST', `${baseUrl}/v1/auth/login`, testUser)
      .then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.user.isEmailVerified).to.be.true;
        
        cy.wrap(response.body.accessToken).as('verifiedAccessToken');
      });

    // Step 4: Create API key
    cy.get('@verifiedAccessToken').then((accessToken) => {
      cy.request({
        method: 'POST',
        url: `${baseUrl}/v1/auth/api-keys`,
        headers: { Authorization: `Bearer ${accessToken}` },
        body: {
          name: 'E2E Test Key',
          scopes: ['read', 'write']
        }
      }).then((response) => {
        expect(response.status).to.eq(201);
        expect(response.body.key).to.exist;
        
        cy.wrap(response.body.key).as('apiKey');
      });
    });

    // Step 5: Create post
    cy.get('@apiKey').then((apiKey) => {
      cy.request({
        method: 'POST',
        url: `${baseUrl}/v1/posts`,
        headers: { 'X-API-Key': apiKey },
        body: {
          title: 'E2E Test Post',
          content: 'This post was created during E2E testing to verify the complete user flow.',
          excerpt: 'E2E test post excerpt',
          status: 'published'
        }
      }).then((response) => {
        expect(response.status).to.eq(201);
        expect(response.body.post.title).to.eq('E2E Test Post');
        expect(response.body.post.status).to.eq('published');
        expect(response.body.post.readTime).to.exist;
        
        cy.wrap(response.body.post._id).as('postId');
        cy.wrap(response.body.post.slug).as('postSlug');
      });
    });

    // Step 6: Verify post exists in list
    cy.get('@apiKey').then((apiKey) => {
      cy.request({
        method: 'GET',
        url: `${baseUrl}/v1/posts`,
        headers: { 'X-API-Key': apiKey }
      }).then((response) => {
        expect(response.status).to.eq(200);
        
        const createdPost = response.body.posts.find(
          (post: any) => post.title === 'E2E Test Post'
        );
        expect(createdPost).to.exist;
        expect(createdPost.authorId.email).to.eq(testUser.email);
      });
    });

    // Step 7: Get post by slug
    cy.get('@apiKey').then((apiKey) => {
      cy.get('@postSlug').then((slug) => {
        cy.request({
          method: 'GET',
          url: `${baseUrl}/v1/posts/${slug}`,
          headers: { 'X-API-Key': apiKey }
        }).then((response) => {
          expect(response.status).to.eq(200);
          expect(response.body.post.title).to.eq('E2E Test Post');
          expect(response.body.post.readTime).to.exist;
        });
      });
    });

    // Step 8: Add comment to post
    cy.get('@apiKey').then((apiKey) => {
      cy.get('@postId').then((postId) => {
        cy.request({
          method: 'POST',
          url: `${baseUrl}/v1/comments`,
          headers: { 'X-API-Key': apiKey },
          body: {
            content: 'This is a test comment on the E2E test post.',
            postId
          }
        }).then((response) => {
          expect(response.status).to.eq(201);
          expect(response.body.comment.content).to.include('test comment');
          expect(response.body.comment.status).to.eq('pending'); // Requires moderation
        });
      });
    });

    // Step 9: Like the post
    cy.get('@apiKey').then((apiKey) => {
      cy.get('@postId').then((postId) => {
        cy.request({
          method: 'POST',
          url: `${baseUrl}/v1/posts/${postId}/like`,
          headers: { 'X-API-Key': apiKey }
        }).then((response) => {
          expect(response.status).to.eq(200);
          expect(response.body.liked).to.be.true;
          expect(response.body.likes).to.eq(1);
        });
      });
    });

    // Step 10: Delete post (soft delete)
    cy.get('@apiKey').then((apiKey) => {
      cy.get('@postId').then((postId) => {
        cy.request({
          method: 'DELETE',
          url: `${baseUrl}/v1/posts/${postId}`,
          headers: { 'X-API-Key': apiKey }
        }).then((response) => {
          expect(response.status).to.eq(200);
          expect(response.body.message).to.include('deleted');
        });
      });
    });

    // Step 11: Verify post is no longer in list
    cy.get('@apiKey').then((apiKey) => {
      cy.request({
        method: 'GET',
        url: `${baseUrl}/v1/posts`,
        headers: { 'X-API-Key': apiKey }
      }).then((response) => {
        expect(response.status).to.eq(200);
        
        const deletedPost = response.body.posts.find(
          (post: any) => post.title === 'E2E Test Post'
        );
        expect(deletedPost).to.be.undefined;
      });
    });

    // Step 12: Cleanup - revoke API key
    cy.get('@verifiedAccessToken').then((accessToken) => {
      cy.request({
        method: 'GET',
        url: `${baseUrl}/v1/auth/api-keys`,
        headers: { Authorization: `Bearer ${accessToken}` }
      }).then((response) => {
        const apiKeyId = response.body.apiKeys[0].id;
        
        return cy.request({
          method: 'DELETE',
          url: `${baseUrl}/v1/auth/api-keys/${apiKeyId}`,
          headers: { Authorization: `Bearer ${accessToken}` }
        });
      }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.message).to.include('revoked');
      });
    });
  });

  it('Google OAuth flow simulation', () => {
    // Test Google OAuth endpoint (will return 501 if not configured)
    cy.request({
      method: 'GET',
      url: `${baseUrl}/v1/auth/google`,
      followRedirect: false,
      failOnStatusCode: false
    }).then((response) => {
      if (response.status === 302) {
        // OAuth configured - should redirect to Google
        expect(response.headers.location).to.include('google');
      } else {
        // OAuth not configured - should return 501
        expect(response.status).to.eq(501);
        expect(response.body.error).to.include('not configured');
      }
    });

    // Test Google OAuth callback
    cy.request({
      method: 'GET',
      url: `${baseUrl}/v1/auth/google/callback`,
      followRedirect: false,
      failOnStatusCode: false
    }).then((response) => {
      // Should handle callback appropriately
      expect(response.status).to.be.oneOf([302, 501]);
    });
  });

  it('Frontend integration test', () => {
    // Test that frontend pages load
    cy.visit(`${webUrl}/`, { failOnStatusCode: false });
    
    // Should show homepage
    cy.get('body').should('contain.text', 'Blog');
    
    // Test posts page
    cy.visit(`${webUrl}/posts`, { failOnStatusCode: false });
    
    // Should show posts interface
    cy.get('body').should('be.visible');
  });
});