const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config();

// Import security middleware
const { authenticate } = require(path.join(__dirname, '../../../shared/middleware/auth'));
const { lenientLimiter, strictLimiter } = require(path.join(__dirname, '../../../shared/middleware/rateLimiter'));

const app = express();
const PORT = process.env.PORT || 3003;

// Trust proxy - required for rate limiting behind reverse proxy
app.set('trust proxy', 1);

// Middleware
app.use(cors());
// Increase body size limit to handle Base64 encoded QR code images (10MB)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Apply rate limiting to all API routes
app.use('/api', lenientLimiter);

// Health check (no auth required)
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    service: 'Inventory Service', 
    port: PORT,
    security: {
      authentication: 'API Key (X-API-Key header)',
      rateLimiting: 'Active'
    }
  });
});

// Apply authentication to all API routes
app.use('/api', authenticate);

// Routes
const inventoryRoutes = require('./routes/inventory');
app.use('/api', inventoryRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Inventory Service running on port ${PORT}`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
  console.log(`🔐 Security: Authentication (API Key) + Rate Limiting ENABLED`);
  console.log(`🔑 API Key: ${process.env.API_KEY || 'dev-api-key-12345 (development default)'}`);
});

module.exports = app;
