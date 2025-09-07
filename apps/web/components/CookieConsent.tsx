import { useState, useEffect } from 'react';
import { Box, Button, Typography, Paper, Link } from '@mui/material';

export default function CookieConsent() {
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('cookieConsent');
    if (!consent) {
      setShowBanner(true);
    }
  }, []);

  const acceptAll = () => {
    localStorage.setItem('cookieConsent', JSON.stringify({
      necessary: true,
      analytics: true,
      marketing: false,
      acceptedAt: new Date().toISOString()
    }));
    setShowBanner(false);
  };

  const acceptNecessary = () => {
    localStorage.setItem('cookieConsent', JSON.stringify({
      necessary: true,
      analytics: false,
      marketing: false,
      acceptedAt: new Date().toISOString()
    }));
    setShowBanner(false);
  };

  if (!showBanner) return null;

  return (
    <Paper
      sx={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        p: 3,
        borderRadius: 0,
        boxShadow: '0 -2px 10px rgba(0,0,0,0.1)',
        backgroundColor: 'background.paper'
      }}
    >
      <Box maxWidth="lg" mx="auto">
        <Typography variant="h6" gutterBottom>
          🍪 Cookie Consent
        </Typography>
        
        <Typography variant="body2" color="text.secondary" paragraph>
          We use cookies to enhance your experience, analyze site usage, and assist in our marketing efforts. 
          By clicking "Accept All", you consent to our use of cookies.
        </Typography>

        <Typography variant="body2" color="text.secondary" paragraph>
          <strong>Necessary cookies:</strong> Required for basic site functionality (authentication, security)
          <br />
          <strong>Analytics cookies:</strong> Help us understand how you use our site (anonymized data)
        </Typography>

        <Box display="flex" gap={2} flexWrap="wrap" alignItems="center">
          <Button 
            variant="contained" 
            onClick={acceptAll}
            size="small"
          >
            Accept All
          </Button>
          
          <Button 
            variant="outlined" 
            onClick={acceptNecessary}
            size="small"
          >
            Necessary Only
          </Button>
          
          <Link 
            href="/legal/privacy-policy.md" 
            target="_blank"
            variant="body2"
            sx={{ ml: 2 }}
          >
            Privacy Policy
          </Link>
          
          <Link 
            href="/legal/terms-of-service.md" 
            target="_blank"
            variant="body2"
          >
            Terms of Service
          </Link>
        </Box>
      </Box>
    </Paper>
  );
}