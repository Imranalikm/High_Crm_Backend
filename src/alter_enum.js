const sequelize = require('./config/database');

async function alterEnum() {
  try {
    // Attempt to add the value to the ENUM in PostgreSQL.
    // This query is safe to run multiple times, as we catch errors if the value already exists.
    // In PostgreSQL, you cannot use "IF NOT EXISTS" inside a transaction block in older versions, 
    // but typically ALTER TYPE ADD VALUE IF NOT EXISTS is supported in modern PostgreSQL.
    await sequelize.query(`ALTER TYPE "enum_bank_accounts_type" ADD VALUE IF NOT EXISTS 'upi';`);
    console.log("Successfully altered enum or value already existed.");
  } catch (error) {
    console.error("Error altering enum:", error.message);
  } finally {
    process.exit(0);
  }
}

alterEnum();
