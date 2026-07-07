const depositController = require('./src/controllers/deposit.controller');
const { sequelize } = require('./src/models');

async function test() {
  await sequelize.authenticate();
  const req = {
    user: { id: 1, role: { type: 'user' } },
    body: {
      accountId: '123',
      amount: '100',
      type: 'upi',
      note: 'test note'
    },
    file: { path: 'dummy/path' }
  };
  
  const res = {
    status: function(s) {
      console.log('Status:', s);
      return this;
    },
    json: function(d) {
      console.log('JSON:', d);
    }
  };
  
  console.log('Running createDeposit...');
  await depositController.createDeposit(req, res);
  console.log('Done.');
  process.exit(0);
}

test().catch(console.error);
