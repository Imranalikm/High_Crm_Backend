const http = require('http');
const { User, Role } = require('./src/models');
const { generateAccessToken } = require('./src/utils/jwt.helper');

async function test() {
  const admin = await User.findOne({ include: [{ model: Role, as: 'role', where: { type: 'admin' } }] });
  if (!admin) {
    console.log("No admin found");
    process.exit(1);
  }
  
  const token = generateAccessToken(admin);
  
  const req = http.request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/bank-accounts/user/6',
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  }, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      console.log('Status:', res.statusCode);
      console.log('Response:', data);
      process.exit(0);
    });
  });
  
  req.on('error', e => {
    console.error(`Problem with request: ${e.message}`);
    process.exit(1);
  });
  
  req.end();
}
test();
