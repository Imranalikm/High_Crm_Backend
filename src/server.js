const app = require('./app');
const { sequelize } = require('./models');
const seedDatabase = require('./seeders/dbSeeder');
require('dotenv').config();

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    console.log('[Server] Connecting to database...');
    // Authenticate database connection
    await sequelize.authenticate();
    console.log('[Database] Connection has been established successfully.');

    // Sync database schema.
    // In development mode, { alter: true } matches the database columns to the models.
    const isDev = process.env.NODE_ENV === 'development';
    await sequelize.sync({ alter: isDev });
    console.log('[Database] Models synchronized with schema.');

    // Seed database with initial roles, modules, permissions matrix and default Super Admin user
    await seedDatabase();

    // Start Express server listening
    app.listen(PORT, () => {
      console.log(`[Server] Server is running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode.`);
      console.log(`[Server] API endpoints available at: http://localhost:${PORT}/api`);
    });
  } catch (error) {
    console.error('[Server] Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
// Trigger nodemon restart
