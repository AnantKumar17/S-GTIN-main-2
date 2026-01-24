const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const path = require('path');

// Load environment variables
dotenv.config();

// Import security middleware
const { authenticate } = require(path.join(__dirname, '../../../shared/middleware/auth'));
const { sgtinGenerationLimiter, lenientLimiter, strictLimiter } = require(path.join(__dirname, '../../../shared/middleware/rateLimiter'));

const app = express();
const PORT = process.env.PORT || 3001;

// Trust proxy - required for rate limiting behind reverse proxy
app.set('trust proxy', 1);

// Middleware
app.use(cors());
app.use(express.json());

// Apply rate limiting to all API routes
app.use('/api', lenientLimiter);

// Swagger documentation (no auth required)
const swaggerDocument = YAML.load(path.join(__dirname, '../../../docs/sgtin-service-api.yaml'));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Health check (no auth required)
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    service: 'SGTIN Service', 
    port: PORT,
    security: {
      authentication: 'API Key (X-API-Key header)',
      rateLimiting: 'Active'
    }
  });
});

// Apply authentication to all API routes
app.use('/api/sgtin', authenticate);

// Routes with specific rate limiters
const sgtinRoutes = require('./routes/sgtin');
app.use('/api/sgtin', sgtinRoutes);

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
  console.log(`🚀 SGTIN Service running on port ${PORT}`);
  console.log(`📚 API Documentation: http://localhost:${PORT}/api-docs`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
  console.log(`🔐 Security: Authentication (API Key) + Rate Limiting ENABLED`);
  console.log(`🔑 API Key: ${process.env.API_KEY || 'dev-api-key-12345 (development default)'}`);
});

module.exports = app;
