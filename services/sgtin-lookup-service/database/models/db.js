// Database Connection Pool
// Singleton pattern for PostgreSQL connection

const { Pool } = require('pg');
require('dotenv').config();

let pool = null;

/**
 * Get database connection pool
 * @returns {Pool} PostgreSQL connection pool
 */
function getPool() {
  if (!pool) {
    pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'sgtin_db',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      max: 50, // Increased pool size to handle more concurrent connections
      min: 5,  // Minimum number of clients in pool
      idleTimeoutMillis: 10000, // Reduced idle timeout
      connectionTimeoutMillis: 5000, // Increased connection timeout
      acquireTimeoutMillis: 60000, // Added acquire timeout
      createTimeoutMillis: 30000,  // Added create timeout
      destroyTimeoutMillis: 5000,  // Added destroy timeout
      reapIntervalMillis: 1000,    // Added reap interval
      createRetryIntervalMillis: 200, // Added retry interval
    });

    pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err);
      process.exit(-1);
    });

    pool.on('connect', (client) => {
      console.log('New client connected to database');
    });

    pool.on('remove', (client) => {
      console.log('Client removed from pool');
    });

    console.log('Database connection pool created with improved settings');
  }

  return pool;
}

/**
 * Execute a query with parameters
 * @param {string} text - SQL query text
 * @param {Array} params - Query parameters
 * @returns {Promise} Query result
 */
async function query(text, params) {
  const start = Date.now();
  const res = await getPool().query(text, params);
  const duration = Date.now() - start;
  
  if (process.env.LOG_SQL === 'true') {
    console.log('Executed query', { text, duration, rows: res.rowCount });
  }
  
  return res;
}

/**
 * Get a client from the pool for transactions
 * @returns {Promise} Database client
 */
async function getClient() {
  return await getPool().connect();
}

/**
 * Close all database connections
 */
async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('Database connection pool closed');
  }
}

module.exports = {
  query,
  getClient,
  getPool,
  closePool
};
