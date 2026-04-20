import { Router } from 'express';
import passport from 'passport';
import {
  register, login, verifyEmail, resendOtp, refreshToken, logout,
  forgotPassword, resetPassword, getMe, googleCallback, updateRole,
} from '../controllers/authController';
import { protect } from '../middleware/auth';

const router = Router();

router.post('/register', register);
router.post('/verify-email', verifyEmail);
router.post('/resend-otp', resendOtp);
router.post('/login', login);
router.post('/refresh', refreshToken);
router.post('/logout', protect, logout);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.get('/me', protect, getMe);
router.patch('/update-role', protect, updateRole);

router.get('/oauth/google', (req, res, next) => {
  if (!process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID === 'your_google_client_id') {
    return res.status(400).json({ success: false, error: { message: 'Google login is not configured on this server yet.' } });
  }
  passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
});

router.get('/oauth/google/callback', (req, res, next) => {
  if (!process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID === 'your_google_client_id') {
    return res.redirect('/auth/login?error=not_configured');
  }
  passport.authenticate('google', { failureRedirect: '/auth/login', session: false })(req, res, next);
}, googleCallback);

export default router;
