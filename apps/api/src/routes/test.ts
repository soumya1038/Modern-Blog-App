import { Router } from 'express';
import { User } from '../models';

const router = Router();

// Test endpoint to get verification token (only for testing)
router.get('/get-verify-token/:email', async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'Not found' });
  }
  
  try {
    const user = await User.findOne({ email: req.params.email });
    if (!user || !user.verifyToken) {
      return res.status(404).json({ error: 'Token not found' });
    }
    
    res.json({ token: user.verifyToken });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Test Google user creation
router.post('/create-google-user', async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'Not found' });
  }
  
  try {
    const user = await User.create(req.body);
    res.status(201).json({ user });
  } catch (error) {
    res.status(500).json({ error: 'User creation failed' });
  }
});

// Test set admin role
router.post('/set-admin-role', async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'Not found' });
  }
  
  try {
    const { email } = req.body;
    const user = await User.findOneAndUpdate(
      { email },
      { role: 'admin' },
      { new: true }
    );
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ message: 'Admin role set', user: { email: user.email, role: user.role } });
  } catch (error) {
    res.status(500).json({ error: 'Failed to set admin role' });
  }
});

// Test cleanup endpoint
router.delete('/cleanup', async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'Not found' });
  }
  
  try {
    await User.deleteMany({ email: { $regex: /test|example/ } });
    res.json({ message: 'Cleanup complete' });
  } catch (error) {
    res.status(500).json({ error: 'Cleanup failed' });
  }
});

export default router;