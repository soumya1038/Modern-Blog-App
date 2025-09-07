import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { User } from '../models';

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID || '',
  clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  callbackURL: '/v1/auth/google/callback',
  state: true // Enable state parameter for CSRF protection
}, async (accessToken, refreshToken, profile, done) => {
  try {
    let user = await User.findOne({ googleId: profile.id });
    
    if (user) {
      return done(null, user);
    }
    
    // Check if user exists with same email
    user = await User.findOne({ email: profile.emails?.[0]?.value });
    
    if (user) {
      // Link Google account to existing user
      user.googleId = profile.id;
      user.avatar = profile.photos?.[0]?.value;
      await user.save();
      return done(null, user);
    }
    
    // Validate profile data
    const email = profile.emails?.[0]?.value;
    if (!email || !email.includes('@') || email.length > 254) {
      return done(new Error('Invalid email from Google'), null);
    }
    
    // Create new user with sanitized data
    user = await User.create({
      email,
      provider: 'google',
      googleId: profile.id,
      isEmailVerified: true,
      avatar: profile.photos?.[0]?.value?.substring(0, 500), // Limit avatar URL length
      role: 'user', // Ensure default role
    });
    
    done(null, user);
  } catch (error) {
    done(error, undefined);
  }
}));

passport.serializeUser((user: any, done) => {
  done(null, user._id);
});

passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

export default passport;