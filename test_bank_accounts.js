const { BankAccount } = require('./src/models');
async function test() {
  const accounts = await BankAccount.findAll();
  console.log(JSON.stringify(accounts, null, 2));
  process.exit(0);
}
test();
