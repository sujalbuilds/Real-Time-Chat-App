const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/usermodel');
const jwt = require('../config/jwt');
const router = express.Router();

function requireAuth(req, res, next) {
  const token = req.cookies.token;
  if (!token) {
    return res.status(401).json({ message: 'Not authenticated' });
  }
  try {
    const payload = jwt.verify(token);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token' });
  }
}

router.post(
  '/register',
  [
    body('username').isAlphanumeric().withMessage('Username must be alphanumeric'),
    body('email').isEmail().withMessage('Please provide a valid email'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { username, email, password } = req.body;
    try {
    
      if (await User.findOne({ email })) {
        return res.status(400).json({ message: 'Email already in use' });
      }
      if (await User.findOne({ username })) {
        return res.status(400).json({ message: 'Username already taken' });
      }

      const user = new User({ username, email, password });
      await user.save();

      const token = jwt.sign({ id: user._id, username: user.username });

      res
        .cookie('token', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
          maxAge: 24 * 60 * 60 * 1000 
        })
        .status(201)
        .json({ user: { id: user._id, username: user.username, email: user.email } });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Server error during registration' });
    }
  }
);

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user._id, username: user.username });
    res
      .cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 24 * 60 * 60 * 1000
      })
      .json({ user: { id: user._id, username: user.username, email: user.email } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Login error' });
  }
});

router.post('/logout', (req, res) => {
  res
    .clearCookie('token', { path: '/' })
    .json({ message: 'Logged out' });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ id: req.user.id, username: req.user.username });
});

module.exports = router;
