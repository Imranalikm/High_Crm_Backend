const http = require('http');
const app = require('./app');
const { sequelize } = require('./models');
const seedDatabase = require('./seeders/dbSeeder');
require('dotenv').config();
const { initSocket } = require('./config/socket');

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    console.log('[Server] Connecting to database...');
    // Authenticate database connection
    await sequelize.authenticate();
    console.log('[Database] Connection has been established successfully.');

    // Sync database schema.
    // In development mode, { alter: true } matches the database columns to the models.
    // Ensure new attachments column exists on ticket_messages table (avoids buggy sequelize sync alter)
    try {
      await sequelize.query('ALTER TABLE "ticket_messages" ADD COLUMN IF NOT EXISTS "attachments" JSONB;');
      await sequelize.query('ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "attachments" JSONB;');
      console.log('[Database] Checked attachments column on tickets and ticket_messages.');
    } catch (e) {
      console.warn('[Database] Optional sync warning:', e.message);
    }

    await sequelize.sync({ alter: false });
    console.log('[Database] Models synchronized with schema.');

    // Seed database with initial roles, modules, permissions matrix and default Super Admin user
    await seedDatabase();

    // Create HTTP server
    const server = http.createServer(app);
    
    // Initialize Socket.io
    initSocket(server);

    // Start Express server listening
    server.listen(PORT, () => {
      console.log(`[Server] Server is running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode.`);
      console.log(`[Server] API endpoints available at 2: http://localhost:${PORT}/api`);
    });
  } catch (error) {
    console.error('[Server] Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
// Trigger nodemon restart
