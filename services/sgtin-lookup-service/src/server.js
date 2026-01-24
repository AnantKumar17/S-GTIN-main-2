const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config();

// Import security middleware (use local copies inside this service)
const { authenticate } = require(path.join(__dirname, '../../shared/middleware/auth'));
const { lenientLimiter, strictLimiter } = require(path.join(__dirname, '../../shared/middleware/rateLimiter'));

const app = express();
const PORT = process.env.PORT || 3006;

// Trust proxy - required for rate limiting behind reverse proxy
app.set('trust proxy', 1);

// Middleware
app.use(cors({
  origin: ['http://localhost:8081', 'http://127.0.0.1:8081'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-API-Key'],
  credentials: true
}));
app.use(express.json());

// Apply rate limiting to all API routes
app.use('/api', lenientLimiter);

// Health check (no auth required)
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    service: 'SGTIN Lookup Service', 
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
const sgtinLookupRoutes = require('./routes/sgtinLookup');
app.use('/api', sgtinLookupRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

app.listen(PORT, () => {
  console.log(`🔍 SGTIN Lookup Service running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔐 API endpoints require X-API-Key header`);
});