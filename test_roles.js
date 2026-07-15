const { Role } = require('./src/models');
async function test() {
  const roles = await Role.findAll();
  console.log(JSON.stringify(roles, null, 2));
  process.exit(0);
}
test();
