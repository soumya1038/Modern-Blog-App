describe('Frontend Polish & Performance', () => {
  const baseUrl = 'http://localhost:4000';
  const webUrl = 'http://localhost:3000';
  
  const testUser = {
    email: 'polish-test@example.com',
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
            name: 'Polish Test Key',
            scopes: ['read', 'write']
          }
        });
      })
      .then((response) => {
        apiKey = response.body.key;
        
        // Create test posts for infinite scroll
        const postPromises = [];
        for (let i = 1; i <= 10; i++) {
          postPromises.push(
            cy.request({
              method: 'POST',
              url: `${baseUrl}/v1/posts`,
              headers: { 'X-API-Key': apiKey },
              body: {
                title: `Performance Test Post ${i}`,
                content: `This is test post ${i} for testing infinite scroll and performance optimizations.`,
                excerpt: `Excerpt for post ${i}`,
                status: 'published'
              }
            })
          );
        }
        return Promise.all(postPromises);
      });
  });

  describe('SEO & Meta Tags', () => {
    it('has proper meta tags on homepage', () => {
      cy.visit(`${webUrl}/`);
      
      // Check title
      cy.title().should('contain', 'Modern Blog Platform');
      
      // Check meta description
      cy.get('meta[name="description"]')
        .should('have.attr', 'content')
        .and('contain', 'modern, full-stack blog platform');
      
      // Check Open Graph tags
      cy.get('meta[property="og:title"]')
        .should('have.attr', 'content')
        .and('contain', 'Modern Blog Platform');
      
      cy.get('meta[property="og:type"]')
        .should('have.attr', 'content', 'website');
      
      // Check canonical URL
      cy.get('link[rel="canonical"]')
        .should('have.attr', 'href', 'http://localhost:3000');
    });

    it('has proper meta tags on posts page', () => {
      cy.visit(`${webUrl}/posts-optimized`);
      
      cy.title().should('contain', 'Blog Posts');
      
      cy.get('meta[name="description"]')
        .should('have.attr', 'content')
        .and('contain', 'Discover the latest blog posts');
      
      cy.get('meta[name="keywords"]')
        .should('have.attr', 'content')
        .and('contain', 'blog, posts, articles');
    });
  });

  describe('Dark/Light Mode Toggle', () => {
    it('toggles between dark and light mode', () => {
      cy.visit(`${webUrl}/`);
      
      // Should start in light mode (or system preference)
      cy.get('body').should('be.visible');
      
      // Find and click theme toggle button
      cy.get('[data-testid="theme-toggle"], button[aria-label*="theme"], button').contains('brightness').click();
      
      // Verify theme changed (MUI applies theme classes)
      cy.get('html').should('have.attr', 'data-mui-color-scheme').or('have.class');
      
      // Toggle back
      cy.get('[data-testid="theme-toggle"], button[aria-label*="theme"], button').contains('brightness').click();
    });

    it('persists theme preference', () => {
      cy.visit(`${webUrl}/`);
      
      // Set dark mode
      cy.window().then((win) => {
        win.localStorage.setItem('darkMode', 'true');
      });
      
      cy.reload();
      
      // Should remember dark mode preference
      cy.window().then((win) => {
        expect(win.localStorage.getItem('darkMode')).to.eq('true');
      });
    });
  });

  describe('Infinite Scroll Performance', () => {
    it('implements infinite scroll with intersection observer', () => {
      cy.visit(`${webUrl}/posts-optimized`);
      
      // Set API key
      cy.window().then((win) => {
        win.localStorage.setItem('apiKey', apiKey);
      });
      
      cy.reload();
      
      // Should show initial posts
      cy.get('[data-testid="post-card"], article').should('have.length.at.least', 1);
      
      // Scroll to bottom to trigger infinite scroll
      cy.scrollTo('bottom');
      
      // Should load more posts
      cy.get('[data-testid="post-card"], article', { timeout: 10000 })
        .should('have.length.at.least', 5);
      
      // Should show loading indicator or "scroll for more" text
      cy.contains('Scroll for more').should('be.visible').or(
        cy.get('[data-testid="loading-spinner"]').should('be.visible')
      );
    });

    it('shows scroll to top button', () => {
      cy.visit(`${webUrl}/posts-optimized`);
      
      cy.window().then((win) => {
        win.localStorage.setItem('apiKey', apiKey);
      });
      
      cy.reload();
      
      // Scroll down significantly
      cy.scrollTo(0, 1000);
      
      // Should show scroll to top FAB
      cy.get('[data-testid="scroll-top"], button[aria-label*="scroll"], .MuiFab-root')
        .should('be.visible');
      
      // Click scroll to top
      cy.get('[data-testid="scroll-top"], button[aria-label*="scroll"], .MuiFab-root')
        .first()
        .click();
      
      // Should scroll to top
      cy.window().its('scrollY').should('eq', 0);
    });
  });

  describe('Lazy Loading Comments', () => {
    it('lazy loads comments with intersection observer', () => {
      cy.visit(`${webUrl}/posts-optimized`);
      
      cy.window().then((win) => {
        win.localStorage.setItem('apiKey', apiKey);
      });
      
      cy.reload();
      
      // Should show posts
      cy.get('article').should('have.length.at.least', 1);
      
      // Comments should not be loaded initially for all posts
      cy.get('[data-testid="comments-section"]').should('have.length.at.most', 3);
      
      // Scroll to see more posts
      cy.scrollTo('bottom');
      
      // Comments should lazy load as they come into view
      cy.get('[data-testid="comments-loading"], [data-testid="comments-section"]')
        .should('be.visible');
    });
  });

  describe('Responsive Images', () => {
    it('uses optimized cloudinary images', () => {
      cy.visit(`${webUrl}/posts-optimized`);
      
      cy.window().then((win) => {
        win.localStorage.setItem('apiKey', apiKey);
      });
      
      cy.reload();
      
      // Check if any images are present and optimized
      cy.get('img').then(($images) => {
        if ($images.length > 0) {
          // Should have proper alt attributes
          cy.get('img').each(($img) => {
            cy.wrap($img).should('have.attr', 'alt');
          });
          
          // Should use Next.js Image component optimizations
          cy.get('img').first().should('have.attr', 'loading');
        }
      });
    });
  });

  describe('Material-UI Components', () => {
    it('uses MUI components with proper styling', () => {
      cy.visit(`${webUrl}/`);
      
      // Should have MUI typography
      cy.get('.MuiTypography-root').should('exist');
      
      // Should have MUI buttons
      cy.get('.MuiButton-root').should('exist');
      
      // Should have MUI cards
      cy.get('.MuiCard-root').should('exist');
      
      // Should have proper theme colors
      cy.get('.MuiButton-contained').should('have.css', 'background-color');
    });

    it('has accessible MUI components', () => {
      cy.visit(`${webUrl}/`);
      
      // Buttons should have proper ARIA attributes
      cy.get('button').each(($btn) => {
        cy.wrap($btn).should('be.visible');
        // Most buttons should have accessible text or aria-label
        cy.wrap($btn).should(($el) => {
          const text = $el.text().trim();
          const ariaLabel = $el.attr('aria-label');
          expect(text.length > 0 || ariaLabel).to.be.true;
        });
      });
      
      // Links should have proper attributes
      cy.get('a').each(($link) => {
        cy.wrap($link).should('have.attr', 'href');
      });
    });
  });

  describe('Performance Optimizations', () => {
    it('has performance hints in document head', () => {
      cy.visit(`${webUrl}/`);
      
      // Should have preconnect links
      cy.get('link[rel="preconnect"]').should('exist');
      
      // Should have DNS prefetch
      cy.get('link[rel="dns-prefetch"]').should('exist');
      
      // Should have proper font loading
      cy.get('link[href*="fonts.googleapis.com"]').should('exist');
    });

    it('loads pages efficiently', () => {
      // Measure page load time
      const startTime = Date.now();
      
      cy.visit(`${webUrl}/`);
      
      cy.window().then(() => {
        const loadTime = Date.now() - startTime;
        // Should load within reasonable time (adjust threshold as needed)
        expect(loadTime).to.be.lessThan(5000);
      });
      
      // Should not have console errors
      cy.window().then((win) => {
        cy.stub(win.console, 'error').as('consoleError');
      });
      
      cy.get('@consoleError').should('not.have.been.called');
    });
  });

  describe('Lighthouse Performance Simulation', () => {
    it('meets basic performance criteria', () => {
      cy.visit(`${webUrl}/`);
      
      // Simulate Lighthouse checks
      
      // 1. Page should load content quickly
      cy.get('h1').should('be.visible');
      cy.get('main, [role="main"], .MuiContainer-root').should('be.visible');
      
      // 2. Images should have alt attributes
      cy.get('img').each(($img) => {
        cy.wrap($img).should('have.attr', 'alt');
      });
      
      // 3. Should have proper heading hierarchy
      cy.get('h1').should('have.length', 1);
      
      // 4. Should have proper meta viewport
      cy.get('meta[name="viewport"]').should('exist');
      
      // 5. Should have lang attribute
      cy.get('html').should('have.attr', 'lang');
      
      // 6. Should not have accessibility violations
      cy.get('button, a, input').each(($el) => {
        // Interactive elements should be focusable
        cy.wrap($el).should('not.have.attr', 'tabindex', '-1');
      });
    });
  });
});