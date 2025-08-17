const jwt = require('jsonwebtoken');
const db = require('../config/database');
const logger = require('../config/logger');

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access token required'
      });
    }

    const token = authHeader.replace('Bearer ', '');

    // Verify JWT token
    const decoded = jwt.verify(token, JWT_SECRET);

    // Check if token exists and is valid in database
    const [tokens] = await db.execute(
      'SELECT ut.*, u.email, u.is_active FROM user_tokens ut JOIN users u ON ut.user_id = u.id WHERE ut.token = ? AND ut.is_valid = TRUE AND ut.expires_at > NOW()',
      [token]
    );

    if (tokens.length === 0) {
      logger.warn('Invalid or expired token used', {
        token: token.substring(0, 20) + '...',
        ip: req.ip
      });
      
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }

    const tokenData = tokens[0];

    if (!tokenData.is_active) {
      logger.warn('Token used for inactive user', {
        userId: tokenData.user_id,
        ip: req.ip
      });
      
      return res.status(401).json({
        success: false,
        message: 'User account is inactive'
      });
    }

    // Add user information to request object
    req.user = {
      userId: tokenData.user_id,
      email: tokenData.email,
      tokenId: tokenData.id
    };

    // Update token last used timestamp
    await db.execute(
      'UPDATE user_tokens SET last_used = NOW() WHERE id = ?',
      [tokenData.id]
    );

    next();

  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      logger.warn('Invalid JWT token', {
        error: error.message,
        ip: req.ip
      });
      
      return res.status(401).json({
        success: false,
        message: 'Invalid token format'
      });
    }

    if (error.name === 'TokenExpiredError') {
      logger.warn('Expired JWT token', {
        error: error.message,
        ip: req.ip
      });
      
      return res.status(401).json({
        success: false,
        message: 'Token has expired'
      });
    }

    logger.error('Authentication middleware error', {
      error: error.message,
      ip: req.ip
    });

    res.status(500).json({
      success: false,
      message: 'Authentication failed'
    });
  }
};

module.exports = authMiddleware;