const { User } = require('./src/models');

async function test() {
  const users = await User.findAll({ attributes: ['id', 'name', 'email'] });
  console.log(JSON.stringify(users, null, 2));
  process.exit(0);
}
test();
