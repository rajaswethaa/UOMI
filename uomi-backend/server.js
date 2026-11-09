
const express = require('express');
const cors = require('cors');
const path = require('path');

// Load environment variables before importing database configuration
require('dotenv').config({
  path: path.resolve(__dirname, '.env')
});

const { pool } = require('./src/config/db');
const routes = require('./src/routes/index');

const { notFound, errorHandler } = require('./src/middleware/error.middleware');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Basic health check
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'UOMi backend is running'
  });
});

// Database health check
app.get('/api/health/db', async (req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT current_database() AS database, NOW() AS time'
    );

    res.status(200).json({
      success: true,
      message: 'PostgreSQL connected successfully',
      database: result.rows[0].database,
      time: result.rows[0].time
    });
  } catch (error) {
    next(error);
  }
});

// Application routes
app.use('/api', routes);

// Handle unknown routes
app.use(notFound);

// Central error handler (must be last)
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log('\n========== UOMi Backend Started ==========');
  console.log(`Server running: http://localhost:${PORT}`);
  console.log(`Database: ${process.env.DB_NAME}`);
  console.log('==========================================\n');
});

// Handle unexpected errors
process.on('unhandledRejection', (error) => {
  console.error('Unhandled Promise Rejection:', error);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  server.close(() => {
    process.exit(1);
  });
});

// Graceful shutdown
async function shutdown() {
  console.log('\nShutting down UOMi backend...');

  server.close(async () => {
    try {
      await pool.end();
      console.log('Database connection closed.');
      process.exit(0);
    } catch (error) {
      console.error('Shutdown error:', error);
      process.exit(1);
    }
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
