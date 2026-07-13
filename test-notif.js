const { sequelize, AppNotification } = require('./src/models');

async function test() {
  try {
    await sequelize.authenticate();
    console.log('Connected to DB');

    // Force sync just this table
    await AppNotification.sync({ alter: true });
    console.log('AppNotification table synchronized');

    const count = await AppNotification.count();
    console.log(`Current notifications count: ${count}`);

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

test();
