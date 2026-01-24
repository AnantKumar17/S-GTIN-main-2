// Rate Limiting Middleware
// Protects APIs from abuse and DDoS attacks

const rateLimit = require('express-rate-limit');

/**
 * Standard rate limiter for general API endpoints - DISABLED FOR DEVELOPMENT
 * 100 requests per 15 minutes per IP
 */
const standardLimiter = (req, res, next) => {
  // Development bypass - no rate limiting
  next();
};

/**
 * Strict rate limiter for sensitive operations - DISABLED FOR DEVELOPMENT
 * 20 requests per 15 minutes per IP
 * Use for operations like: SGTIN generation, PO creation, sales processing
 */
const strictLimiter = (req, res, next) => {
  // Development bypass - no rate limiting
  next();
};

/**
 * Lenient rate limiter for read-only operations - DISABLED FOR DEVELOPMENT
 * 200 requests per 15 minutes per IP
 * Use for: GET requests, validation, trace queries
 */
const lenientLimiter = (req, res, next) => {
  // Development bypass - no rate limiting
  next();
};

/**
 * Custom rate limiter factory
 * Creates a rate limiter with custom settings
 * @param {Object} options - Rate limit options
 * @returns {Function} Rate limiter middleware
 */
function createCustomLimiter(options = {}) {
  const defaults = {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // requests per window
    message: {
      success: false,
      error: 'Too many requests',
      message: 'Rate limit exceeded. Please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false
  };

  return rateLimit({ ...defaults, ...options });
}

/**
 * Rate limiter specifically for SGTIN generation - DISABLED FOR DEVELOPMENT
 * Prevents bulk SGTIN generation abuse
 */
const sgtinGenerationLimiter = (req, res, next) => {
  // Development bypass - no rate limiting
  next();
};

/**
 * Rate limiter for authentication attempts - DISABLED FOR DEVELOPMENT
 * Prevents brute force attacks
 */
const authLimiter = (req, res, next) => {
  // Development bypass - no rate limiting
  next();
};

module.exports = {
  standardLimiter,
  strictLimiter,
  lenientLimiter,
  sgtinGenerationLimiter,
  authLimiter,
  createCustomLimiter
};
