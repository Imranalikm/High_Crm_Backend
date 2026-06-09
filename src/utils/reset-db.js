const { Client } = require('pg');
require('dotenv').config();

async function resetDatabase() {
  console.log('[Reset DB] Starting database reset...');
  
  const config = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    database: 'postgres'
  };

  const client = new Client(config);

  try {
    await client.connect();
    console.log('[Reset DB] Connected to default postgres database.');

    console.log('[Reset DB] Terminating active connections to highcrm...');
    await client.query(`
      SELECT pg_terminate_backend(pg_stat_activity.pid)
      FROM pg_stat_activity
      WHERE pg_stat_activity.datname = 'highcrm'
        AND pid <> pg_backend_pid();
    `).catch(err => console.warn('[Reset DB] Warning terminating connections:', err.message));

    console.log('[Reset DB] Dropping database highcrm...');
    await client.query('DROP DATABASE IF EXISTS highcrm;');

    console.log('[Reset DB] Creating database highcrm...');
    await client.query('CREATE DATABASE highcrm;');

    console.log('[Reset DB] Database reset completed successfully!');
  } catch (error) {
    console.error('[Reset DB] Error resetting database:', error);
  } finally {
    await client.end();
  }
}

resetDatabase();






