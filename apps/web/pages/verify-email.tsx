import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

export default function VerifyEmail() {
  const router = useRouter();
  const { token } = router.query;
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) return;

    fetch(`http://localhost:4000/v1/auth/verify-email?token=${token}`, {
      credentials: 'include',
    })
      .then(res => res.json())
      .then(data => {
        if (data.message) {
          setStatus('success');
          setMessage('Email verified successfully! You can now close this tab.');
          setTimeout(() => router.push('/'), 3000);
        } else {
          setStatus('error');
          setMessage(data.error || 'Verification failed');
        }
      })
      .catch(() => {
        setStatus('error');
        setMessage('Verification failed');
      });
  }, [token, router]);

  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h1>Email Verification</h1>
      {status === 'loading' && <p>Verifying your email...</p>}
      {status === 'success' && <p style={{ color: 'green' }}>{message}</p>}
      {status === 'error' && <p style={{ color: 'red' }}>{message}</p>}
    </div>
  );
}