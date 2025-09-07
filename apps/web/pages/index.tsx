import { Helmet } from 'react-helmet-async';
import { 
  Container, 
  Typography, 
  Button, 
  Box, 
  Card, 
  CardContent,
  Grid,
  IconButton
} from '@mui/material';
import { 
  Article, 
  Comment, 
  Upload, 
  AdminPanelSettings,
  Brightness4,
  Brightness7
} from '@mui/icons-material';
import { useTheme } from './_app';
import CookieConsent from '../components/CookieConsent';

export default function Home() {
  const { darkMode, toggleDarkMode } = useTheme();

  const features = [
    {
      icon: <Article />,
      title: 'Blog Posts',
      description: 'Read and create engaging blog posts with infinite scroll',
      href: '/posts-optimized'
    },
    {
      icon: <Comment />,
      title: 'Comments',
      description: '3-level threaded comments with moderation',
      href: '/comments'
    },
    {
      icon: <Upload />,
      title: 'Media Upload',
      description: 'Drag & drop image uploads with Cloudinary CDN',
      href: '/upload'
    },
    {
      icon: <AdminPanelSettings />,
      title: 'Admin Panel',
      description: 'Comprehensive admin dashboard and tools',
      href: 'http://localhost:3001'
    }
  ];

  return (
    <>
      <Helmet>
        <title>Modern Blog Platform - Full-Stack Blog Application</title>
        <meta name="description" content="A modern, full-stack blog platform with React, Node.js, MongoDB, and advanced features like infinite scroll, dark mode, and admin panel." />
        <meta name="keywords" content="blog, platform, react, nodejs, mongodb, full-stack, modern" />
        <meta property="og:title" content="Modern Blog Platform" />
        <meta property="og:description" content="A modern, full-stack blog platform with advanced features" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="http://localhost:3000" />
        <link rel="canonical" href="http://localhost:3000" />
        
        {/* Performance hints */}
        <link rel="preconnect" href="http://localhost:4000" />
        <link rel="dns-prefetch" href="//res.cloudinary.com" />
      </Helmet>

      <Container maxWidth="lg" sx={{ py: 8 }}>
        {/* Header */}
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={6}>
          <Box>
            <Typography variant="h1" component="h1" gutterBottom>
              Modern Blog Platform
            </Typography>
            <Typography variant="h5" color="text.secondary" paragraph>
              Full-stack blog application with advanced features
            </Typography>
          </Box>
          <IconButton onClick={toggleDarkMode} color="inherit" size="large">
            {darkMode ? <Brightness7 /> : <Brightness4 />}
          </IconButton>
        </Box>

        {/* Quick Actions */}
        <Box display="flex" gap={2} mb={6} flexWrap="wrap">
          <Button 
            variant="contained" 
            size="large" 
            href="/posts-optimized"
            startIcon={<Article />}
          >
            View Posts
          </Button>
          <Button 
            variant="outlined" 
            size="large" 
            href="/api-keys"
          >
            Get API Key
          </Button>
          <Button 
            variant="outlined" 
            size="large" 
            href="http://localhost:3001"
            target="_blank"
          >
            Admin Panel
          </Button>
        </Box>

        {/* Features Grid */}
        <Grid container spacing={4} mb={6}>
          {features.map((feature, index) => (
            <Grid item xs={12} sm={6} md={3} key={index}>
              <Card 
                sx={{ 
                  height: '100%', 
                  cursor: 'pointer',
                  transition: 'transform 0.2s ease-in-out',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                  }
                }}
                onClick={() => window.open(feature.href, feature.href.startsWith('http') ? '_blank' : '_self')}
              >
                <CardContent sx={{ textAlign: 'center', p: 3 }}>
                  <Box color="primary.main" mb={2}>
                    {feature.icon}
                  </Box>
                  <Typography variant="h6" component="h2" gutterBottom>
                    {feature.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {feature.description}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        {/* Performance Features */}
        <Card sx={{ mb: 6 }}>
          <CardContent>
            <Typography variant="h4" component="h2" gutterBottom>
              Performance & Accessibility Features
            </Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom>
                  🚀 Performance Optimizations
                </Typography>
                <ul style={{ margin: 0, paddingLeft: '1.5rem' }}>
                  <li>Infinite scroll with IntersectionObserver</li>
                  <li>Lazy-loaded comments</li>
                  <li>Responsive Cloudinary images with srcset</li>
                  <li>Next.js image optimization</li>
                  <li>CSS-in-JS with emotion</li>
                </ul>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom>
                  ♿ Accessibility Features
                </Typography>
                <ul style={{ margin: 0, paddingLeft: '1.5rem' }}>
                  <li>Material-UI components with ARIA support</li>
                  <li>Semantic HTML structure</li>
                  <li>Dark/light mode toggle</li>
                  <li>Keyboard navigation support</li>
                  <li>Screen reader friendly</li>
                </ul>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Tech Stack */}
        <Card>
          <CardContent>
            <Typography variant="h4" component="h2" gutterBottom>
              Tech Stack
            </Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} md={4}>
                <Typography variant="h6" gutterBottom>
                  Frontend
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  React 18, Next.js, Material-UI, TypeScript, React Helmet Async
                </Typography>
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography variant="h6" gutterBottom>
                  Backend
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Node.js, Express, MongoDB, Redis, BullMQ, Cloudinary
                </Typography>
              </Grid>
              <Grid item xs={12} md={4}>
                <Typography variant="h6" gutterBottom>
                  Features
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  JWT Auth, API Keys, File Upload, Comment Threading, Admin Panel
                </Typography>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Footer */}
        <Box textAlign="center" mt={6} py={4}>
          <Typography variant="body2" color="text.secondary">
            Built with ❤️ using modern web technologies
          </Typography>
        </Box>
      </Container>
      <CookieConsent />
    </>
  );
}