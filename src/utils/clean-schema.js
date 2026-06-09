const { Client } = require('pg');
require('dotenv').config();

async function cleanSchema() {
  console.log('[Clean Schema] Starting clean schema...');
  
  const config = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'highcrm'
  };

  const client = new Client(config);

  try {
    await client.connect();
    console.log('[Clean Schema] Connected to highcrm database.');

    console.log('[Clean Schema] Dropping schema public CASCADE...');
    await client.query('DROP SCHEMA public CASCADE;');

    console.log('[Clean Schema] Recreating schema public...');
    await client.query('CREATE SCHEMA public;');

    console.log('[Clean Schema] Granting permissions on public schema...');
    await client.query('GRANT ALL ON SCHEMA public TO postgres;');
    await client.query('GRANT ALL ON SCHEMA public TO public;');

    console.log('[Clean Schema] Schema wiped and recreated successfully!');
  } catch (error) {
    console.error('[Clean Schema] Error clean schema:', error);
  } finally {
    await client.end();
  }
}

cleanSchema();
