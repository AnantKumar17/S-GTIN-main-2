// Authentication Middleware
// Validates API keys for all services

/**
 * Authentication middleware using API key
 * Checks X-API-Key header against environment variable
 */
function authenticate(req, res, next) {
  const apiKey = req.header('X-API-Key');
  const validApiKey = process.env.API_KEY || 'dev-api-key-12345'; // Default for development

  if (!apiKey) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized - Missing API Key',
      message: 'Please provide X-API-Key header'
    });
  }

  if (apiKey !== validApiKey) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized - Invalid API Key',
      message: 'The provided API key is invalid'
    });
  }

  // API key is valid, proceed to next middleware
  next();
}

/**
 * Optional authentication - allows requests with or without API key
 * Useful for public endpoints that have enhanced features for authenticated users
 */
function optionalAuth(req, res, next) {
  const apiKey = req.header('X-API-Key');
  const validApiKey = process.env.API_KEY || 'dev-api-key-12345';

  // Set authentication status on request object
  req.isAuthenticated = (apiKey && apiKey === validApiKey);
  
  next();
}

/**
 * Skip authentication for specific endpoints
 * Usage: app.use('/api', skipAuthFor(['/health', '/status']), authenticate)
 */
function skipAuthFor(paths) {
  return (req, res, next) => {
    // Check if current path matches any skip paths
    const shouldSkip = paths.some(path => req.path.startsWith(path));
    
    if (shouldSkip) {
      return next('route'); // Skip to next route handler
    }
    
    next();
  };
}

module.exports = {
  authenticate,
  optionalAuth,
  skipAuthFor
};
