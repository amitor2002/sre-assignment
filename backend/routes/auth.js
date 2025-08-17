const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');

const db = require('../config/database');
const logger = require('../config/logger');
const kafkaProducer = require('../config/kafka');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// JWT secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

// Validation rules
const loginValidation = [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }).trim()
];

const registerValidation = [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }).trim(),
  body('firstName').trim().notEmpty(),
  body('lastName').trim().notEmpty()
];

// Register endpoint
router.post('/register', registerValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { email, password, firstName, lastName } = req.body;
    const clientIp = req.ip || req.connection.remoteAddress;

    // Check if user already exists
    const [existingUsers] = await db.execute(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if (existingUsers.length > 0) {
      logger.warn('Registration attempt with existing email', {
        email,
        ip: clientIp
      });
      
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const [result] = await db.execute(
      'INSERT INTO users (email, password, first_name, last_name, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())',
      [email, hashedPassword, firstName, lastName]
    );

    const userId = result.insertId;

    // Log registration activity
    await kafkaProducer.sendUserActivity('REGISTER', userId, clientIp, {
      email,
      firstName,
      lastName
    });

    // Log database change
    await kafkaProducer.sendDatabaseChange('INSERT', 'users', {
      userId,
      email,
      action: 'user_registration'
    });

    logger.info('User registered successfully', {
      userId,
      email,
      ip: clientIp
    });

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        userId,
        email,
        firstName,
        lastName
      }
    });

  } catch (error) {
    logger.error('Registration failed', {
      error: error.message,
      ip: req.ip
    });

    res.status(500).json({
      success: false,
      message: 'Registration failed'
    });
  }
});

// Login endpoint
router.post('/login', loginValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { email, password } = req.body;
    const clientIp = req.ip || req.connection.remoteAddress;

    // Find user
    const [users] = await db.execute(
      'SELECT id, email, password, first_name, last_name, is_active FROM users WHERE email = ?',
      [email]
    );

    if (users.length === 0) {
      logger.warn('Login attempt with non-existent email', {
        email,
        ip: clientIp
      });
      
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    const user = users[0];

    if (!user.is_active) {
      logger.warn('Login attempt for inactive user', {
        userId: user.id,
        email,
        ip: clientIp
      });
      
      return res.status(401).json({
        success: false,
        message: 'Account is inactive'
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      logger.warn('Login attempt with invalid password', {
        userId: user.id,
        email,
        ip: clientIp
      });
      
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Store token in database
    const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    await db.execute(
      'INSERT INTO user_tokens (user_id, token, expires_at, created_at) VALUES (?, ?, ?, NOW())',
      [user.id, token, tokenExpiry]
    );

    // Update last login
    await db.execute(
      'UPDATE users SET last_login = NOW(), updated_at = NOW() WHERE id = ?',
      [user.id]
    );

    // Log successful login activity
    await kafkaProducer.sendUserActivity('LOGIN', user.id, clientIp, {
      email: user.email,
      loginTime: new Date().toISOString(),
      tokenGenerated: true
    });

    // Log database changes
    await kafkaProducer.sendDatabaseChange('INSERT', 'user_tokens', {
      userId: user.id,
      action: 'token_created'
    });

    await kafkaProducer.sendDatabaseChange('UPDATE', 'users', {
      userId: user.id,
      action: 'last_login_updated'
    });

    logger.info('User logged in successfully', {
      userId: user.id,
      email: user.email,
      ip: clientIp,
      tokenExpiry: tokenExpiry.toISOString()
    });

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name
        },
        expiresAt: tokenExpiry.toISOString()
      }
    });

  } catch (error) {
    logger.error('Login failed', {
      error: error.message,
      email: req.body.email,
      ip: req.ip
    });

    res.status(500).json({
      success: false,
      message: 'Login failed'
    });
  }
});

// Logout endpoint
router.post('/logout', authMiddleware, async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    const clientIp = req.ip || req.connection.remoteAddress;

    if (token) {
      // Invalidate token in database
      await db.execute(
        'UPDATE user_tokens SET is_valid = FALSE, updated_at = NOW() WHERE token = ?',
        [token]
      );

      // Log logout activity
      await kafkaProducer.sendUserActivity('LOGOUT', req.user.userId, clientIp, {
        email: req.user.email,
        logoutTime: new Date().toISOString()
      });

      // Log database change
      await kafkaProducer.sendDatabaseChange('UPDATE', 'user_tokens', {
        userId: req.user.userId,
        action: 'token_invalidated'
      });

      logger.info('User logged out successfully', {
        userId: req.user.userId,
        ip: clientIp
      });
    }

    res.json({
      success: true,
      message: 'Logout successful'
    });

  } catch (error) {
    logger.error('Logout failed', {
      error: error.message,
      userId: req.user?.userId,
      ip: req.ip
    });

    res.status(500).json({
      success: false,
      message: 'Logout failed'
    });
  }
});

// Get current user profile
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const [users] = await db.execute(
      'SELECT id, email, first_name, last_name, created_at, last_login FROM users WHERE id = ?',
      [req.user.userId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const user = users[0];

    res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        createdAt: user.created_at,
        lastLogin: user.last_login
      }
    });

  } catch (error) {
    logger.error('Failed to get user profile', {
      error: error.message,
      userId: req.user?.userId
    });

    res.status(500).json({
      success: false,
      message: 'Failed to get user profile'
    });
  }
});

// Verify token endpoint
router.get('/verify', authMiddleware, (req, res) => {
  res.json({
    success: true,
    message: 'Token is valid',
    data: {
      userId: req.user.userId,
      email: req.user.email
    }
  });
});

module.exports = router;