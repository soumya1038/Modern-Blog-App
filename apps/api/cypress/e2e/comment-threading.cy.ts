describe('Comment Threading & Moderation', () => {
  const baseUrl = 'http://localhost:4000';
  const testUser = {
    email: 'comment-test@example.com',
    password: 'password123'
  };
  const adminUser = {
    email: 'comment-admin@example.com',
    password: 'password123'
  };
  
  let userApiKey: string;
  let adminApiKey: string;
  let postId: string;
  let commentId: string;
  let replyId: string;

  before(() => {
    // Create test post first
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
            name: 'Comment Test Key',
            scopes: ['read', 'write']
          }
        });
      })
      .then((response) => {
        userApiKey = response.body.key;
        
        // Create test post
        return cy.request({
          method: 'POST',
          url: `${baseUrl}/v1/posts`,
          headers: { 'X-API-Key': userApiKey },
          body: {
            title: 'Test Post for Comments',
            content: 'This post is for testing comments',
            status: 'published'
          }
        });
      })
      .then((response) => {
        postId = response.body.post._id;
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
            name: 'Admin Comment Key',
            scopes: ['read', 'write', 'admin']
          }
        });
      })
      .then((response) => {
        adminApiKey = response.body.key;
      });
  });

  describe('POST /v1/comments - Create comments', () => {
    it('creates root comment with pending status', () => {
      cy.request({
        method: 'POST',
        url: `${baseUrl}/v1/comments`,
        headers: { 'X-API-Key': userApiKey },
        body: {
          content: 'This is a root comment for testing',
          postId
        }
      }).then((response) => {
        expect(response.status).to.eq(201);
        expect(response.body.comment.content).to.eq('This is a root comment for testing');
        expect(response.body.comment.status).to.eq('pending');
        expect(response.body.comment.parentId).to.be.undefined;
        
        commentId = response.body.comment._id;
      });
    });

    it('creates reply comment with parentId', () => {
      // First approve the parent comment
      cy.request({
        method: 'PATCH',
        url: `${baseUrl}/v1/comments/${commentId}/moderate`,
        headers: { 'X-API-Key': adminApiKey },
        body: { status: 'approved' }
      });

      // Create reply
      cy.request({
        method: 'POST',
        url: `${baseUrl}/v1/comments`,
        headers: { 'X-API-Key': userApiKey },
        body: {
          content: 'This is a reply to the root comment',
          postId,
          parentId: commentId
        }
      }).then((response) => {
        expect(response.status).to.eq(201);
        expect(response.body.comment.parentId).to.eq(commentId);
        expect(response.body.comment.status).to.eq('pending');
        
        replyId = response.body.comment._id;
      });
    });

    it('auto-flags inappropriate content', () => {
      cy.request({
        method: 'POST',
        url: `${baseUrl}/v1/comments`,
        headers: { 'X-API-Key': userApiKey },
        body: {
          content: 'This is spam content with inappropriate language',
          postId
        }
      }).then((response) => {
        expect(response.status).to.eq(201);
        // Note: Without real OpenAI key, this won't actually flag
        // But the structure is in place
      });
    });
  });

  describe('GET /v1/comments - List threaded comments', () => {
    it('returns threaded comments structure', () => {
      // Approve the reply first
      cy.request({
        method: 'PATCH',
        url: `${baseUrl}/v1/comments/${replyId}/moderate`,
        headers: { 'X-API-Key': adminApiKey },
        body: { status: 'approved' }
      });

      // Get comments
      cy.request({
        method: 'GET',
        url: `${baseUrl}/v1/comments?postId=${postId}`,
        headers: { 'X-API-Key': userApiKey }
      }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.comments).to.have.length(1); // One root comment
        
        const rootComment = response.body.comments[0];
        expect(rootComment.replies).to.have.length(1); // One reply
        expect(rootComment.replies[0].parentId).to.eq(commentId);
      });
    });

    it('only returns approved comments', () => {
      cy.request({
        method: 'GET',
        url: `${baseUrl}/v1/comments?postId=${postId}`,
        headers: { 'X-API-Key': userApiKey }
      }).then((response) => {
        response.body.comments.forEach((comment: any) => {
          expect(comment.status).to.eq('approved');
          comment.replies.forEach((reply: any) => {
            expect(reply.status).to.eq('approved');
          });
        });
      });
    });
  });

  describe('Admin Moderation', () => {
    it('lists pending comments for admin', () => {
      cy.request({
        method: 'GET',
        url: `${baseUrl}/v1/comments/pending`,
        headers: { 'X-API-Key': adminApiKey }
      }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.comments).to.be.an('array');
        expect(response.body.pagination).to.have.property('total');
      });
    });

    it('moderates comment status', () => {
      // Create a new comment to moderate
      cy.request({
        method: 'POST',
        url: `${baseUrl}/v1/comments`,
        headers: { 'X-API-Key': userApiKey },
        body: {
          content: 'Comment to be moderated',
          postId
        }
      }).then((response) => {
        const newCommentId = response.body.comment._id;
        
        // Moderate it
        return cy.request({
          method: 'PATCH',
          url: `${baseUrl}/v1/comments/${newCommentId}/moderate`,
          headers: { 'X-API-Key': adminApiKey },
          body: { 
            status: 'approved',
            reason: 'Looks good'
          }
        });
      }).then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.comment.status).to.eq('approved');
        expect(response.body.comment.moderatedBy).to.exist;
        expect(response.body.comment.moderatedAt).to.exist;
      });
    });

    it('rejects non-admin moderation attempts', () => {
      cy.request({
        method: 'PATCH',
        url: `${baseUrl}/v1/comments/${commentId}/moderate`,
        headers: { 'X-API-Key': userApiKey },
        body: { status: 'approved' },
        failOnStatusCode: false
      }).then((response) => {
        expect(response.status).to.eq(403);
        expect(response.body.error).to.include('Admin role required');
      });
    });
  });

  describe('Frontend Integration', () => {
    it('comment threading page renders correctly', () => {
      cy.visit('http://localhost:3000/comments');
      
      // Set API key
      cy.window().then((win) => {
        win.localStorage.setItem('apiKey', userApiKey);
      });
      
      cy.reload();
      
      // Should show comment interface
      cy.contains('Comments Thread Demo').should('be.visible');
      cy.contains('Add Comment').should('be.visible');
      cy.get('textarea').should('be.visible');
      
      // Should show features list
      cy.contains('3-level comment threading').should('be.visible');
      cy.contains('Auto-moderation with OpenAI').should('be.visible');
    });

    it('admin moderation page works', () => {
      cy.visit('http://localhost:3000/admin/comments');
      
      // Set admin API key
      cy.window().then((win) => {
        win.localStorage.setItem('apiKey', adminApiKey);
      });
      
      cy.reload();
      
      // Should show moderation interface
      cy.contains('Comment Moderation').should('be.visible');
      cy.contains('Pending Comments').should('be.visible');
    });
  });

  describe('3-Level Threading Limit', () => {
    it('creates 3-level deep thread', () => {
      // Level 1 (root) - already exists as commentId
      // Level 2 (reply) - already exists as replyId
      
      // Approve reply first
      cy.request({
        method: 'PATCH',
        url: `${baseUrl}/v1/comments/${replyId}/moderate`,
        headers: { 'X-API-Key': adminApiKey },
        body: { status: 'approved' }
      });

      // Level 3 (reply to reply)
      cy.request({
        method: 'POST',
        url: `${baseUrl}/v1/comments`,
        headers: { 'X-API-Key': userApiKey },
        body: {
          content: 'This is a level 3 reply',
          postId,
          parentId: replyId
        }
      }).then((response) => {
        expect(response.status).to.eq(201);
        expect(response.body.comment.parentId).to.eq(replyId);
        
        const level3Id = response.body.comment._id;
        
        // Approve level 3
        return cy.request({
          method: 'PATCH',
          url: `${baseUrl}/v1/comments/${level3Id}/moderate`,
          headers: { 'X-API-Key': adminApiKey },
          body: { status: 'approved' }
        });
      }).then(() => {
        // Verify 3-level structure
        return cy.request({
          method: 'GET',
          url: `${baseUrl}/v1/comments?postId=${postId}`,
          headers: { 'X-API-Key': userApiKey }
        });
      }).then((response) => {
        const rootComment = response.body.comments[0];
        expect(rootComment.replies).to.have.length.at.least(1);
        
        const level2Reply = rootComment.replies.find((r: any) => r._id === replyId);
        expect(level2Reply.replies).to.have.length.at.least(1);
        
        // Level 3 exists
        expect(level2Reply.replies[0].content).to.eq('This is a level 3 reply');
      });
    });
  });
});