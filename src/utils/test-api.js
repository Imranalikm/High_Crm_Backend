const app = require('../app');
const { sequelize, User, Role, Module, RolePermission } = require('../models');
const seedDatabase = require('../seeders/dbSeeder');

const TEST_PORT = 5999;
const BASE_URL = `http://localhost:${TEST_PORT}/api`;

// Helper to make fetch requests easier in the script
async function request(path, method = 'GET', body = null, token = null) {
  const headers = {
    'Content-Type': 'application/json'
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const options = {
    method,
    headers
  };
  if (body) {
    options.body = JSON.stringify(body);
  }

  const res = await fetch(`${BASE_URL}${path}`, options);
  const data = await res.json();
  return { status: res.status, data };
}

async function runTests() {
  console.log('\n==================================================');
  console.log('      STARTING HIGH-CRM REFACTORED RBAC & OTP TESTS ');
  console.log('==================================================\n');

  let server;

  try {
    console.log('[Test Setup] Authenticating database connection...');
    await sequelize.authenticate();
    console.log('[Test Setup] Resetting database tables for a clean test state...');
    
    // drops tables and re-seeds
    await sequelize.sync({ force: true });
    console.log('[Test Setup] Database schema reset complete.');

    console.log('[Test Setup] Seeding default system roles and modules...');
    await seedDatabase();
    console.log('[Test Setup] Seeding completed.');

    // Start Express server on test port
    server = app.listen(TEST_PORT);
    console.log(`[Test Setup] Temporary test server started on http://localhost:${TEST_PORT}`);

    let testUserToken = null;
    let superAdminToken = null;
    let testUserId = null;
    let auditRoleId = null;

    // --- TEST 1: Register a new user with the new schema fields ---
    console.log('\n[TEST 1] Registering a new user with detailed profile fields...');
    const registerRes = await request('/auth/register', 'POST', {
      name: 'John Doe',
      email: 'johndoe@example.com',
      password: 'password123',
      country: 'Canada',
      phone: '+15551234567',
      lb_name: 'Test LB Branch',
      isIB: true
    });

    if (registerRes.status === 201) {
      console.log('✅ Registration successful!');
      testUserId = registerRes.data.data.user.id;
      console.log(`   Registered User ID: ${testUserId}`);
      console.log(`   Assigned Role: ${registerRes.data.data.user.role.name}`);
      console.log(`   Initial Status: ${registerRes.data.data.user.status} (pending)`);
    } else {
      throw new Error(`Registration failed: ${JSON.stringify(registerRes.data)}`);
    }

    // --- TEST 2: Attempt traditional login while status is 'pending' ---
    console.log('\n[TEST 2] Trying to login traditionally while status is pending...');
    const loginFailRes = await request('/auth/login', 'POST', {
      email: 'johndoe@example.com',
      password: 'password123'
    });

    if (loginFailRes.status === 403) {
      console.log('✅ Correctly blocked traditional login for pending user with 403!');
      console.log(`   Response Message: "${loginFailRes.data.message}"`);
    } else {
      throw new Error(`Security breach: Pending user logged in traditionally with status ${loginFailRes.status}`);
    }

    // --- TEST 3: Request OTP and dispatch via SMTP ---
    console.log('\n[TEST 3] Requesting OTP code to email...');
    
    // Stub Math.random to make the generated OTP code predictable ("550000")
    const originalRandom = Math.random;
    Math.random = () => 0.5; // Math.floor(100000 + 0.5 * 900000) = 550000
    
    const sendOtpRes = await request('/auth/otp/send', 'POST', {
      email: 'johndoe@example.com'
    });
    
    // Restore random
    Math.random = originalRandom;

    if (sendOtpRes.status === 200) {
      console.log('✅ OTP requested successfully!');
      console.log(`   Server Response: "${sendOtpRes.data.message}"`);
    } else {
      throw new Error(`Failed to request OTP: ${JSON.stringify(sendOtpRes.data)}`);
    }

    // --- TEST 4: Verify OTP code with incorrect code ---
    console.log('\n[TEST 4] Verifying OTP with an incorrect code...');
    const verifyFailRes = await request('/auth/otp/verify', 'POST', {
      email: 'johndoe@example.com',
      otp: '999999'
    });

    if (verifyFailRes.status === 401) {
      console.log('✅ Correctly rejected incorrect OTP with 401 Unauthorized!');
    } else {
      throw new Error(`Security breach: Verified account with incorrect OTP. Status: ${verifyFailRes.status}`);
    }

    // --- TEST 5: Verify OTP code with correct predicted code ("550000") ---
    console.log('\n[TEST 5] Verifying OTP with the correct code ("550000")...');
    const verifySuccessRes = await request('/auth/otp/verify', 'POST', {
      email: 'johndoe@example.com',
      otp: '550000'
    });

    if (verifySuccessRes.status === 200) {
      console.log('✅ OTP verification successful!');
      testUserToken = verifySuccessRes.data.data.accessToken;
      console.log(`   New Account Status: ${verifySuccessRes.data.data.user.status} (active)`);
    } else {
      throw new Error(`OTP verification failed: ${JSON.stringify(verifySuccessRes.data)}`);
    }

    // --- TEST 6: Login traditionally now that user is 'active' ---
    console.log('\n[TEST 6] Logging in traditionally now that account is active...');
    const loginSuccessRes = await request('/auth/login', 'POST', {
      email: 'johndoe@example.com',
      password: 'password123'
    });

    if (loginSuccessRes.status === 200) {
      console.log('✅ Traditional login successful!');
      testUserToken = loginSuccessRes.data.data.accessToken;
    } else {
      throw new Error(`Traditional login failed for active user: ${JSON.stringify(loginSuccessRes.data)}`);
    }

    // --- TEST 7: Fetch profile and verify all new fields are populated ---
    console.log('\n[TEST 7] Fetching profile details (GET /auth/me) for John Doe...');
    const meRes = await request('/auth/me', 'GET', null, testUserToken);
    if (meRes.status === 200) {
      const u = meRes.data.data.user;
      console.log('✅ Profile retrieved successfully!');
      console.log(`   Name: ${u.name}`);
      console.log(`   Email: ${u.email}`);
      console.log(`   Country: ${u.country}`);
      console.log(`   Phone: ${u.phone}`);
      console.log(`   LB Name: ${u.lb_name}`);
      console.log(`   Is IB: ${u.isIB}`);
      console.log(`   Wallet Balance: ${u.wallet_balance}`);
      console.log('   Permissions Matrix loaded successfully.');
    } else {
      throw new Error(`Failed to fetch profile: ${JSON.stringify(meRes.data)}`);
    }

    // --- TEST 8: Attempt to access admin user list (GET /users) with Read-Only user ---
    console.log('\n[TEST 8] Attempting to access admin user list with standard user...');
    const usersRes = await request('/users', 'GET', null, testUserToken);
    if (usersRes.status === 403) {
      console.log('✅ Access denied correctly with 403 Forbidden!');
    } else {
      throw new Error(`Security breach: Read-Only user accessed admin routes.`);
    }

    // --- TEST 9: Login as Super Admin ---
    console.log('\n[TEST 9] Logging in as default Super Admin...');
    const adminLoginRes = await request('/auth/login', 'POST', {
      email: 'admin@highcrm.com',
      password: 'AdminPassword123!'
    });

    if (adminLoginRes.status === 200) {
      console.log('✅ Super Admin login successful!');
      superAdminToken = adminLoginRes.data.data.accessToken;
    } else {
      throw new Error(`Super Admin login failed: ${JSON.stringify(adminLoginRes.data)}`);
    }

    // --- TEST 10: Super Admin retrieves users ---
    console.log('\n[TEST 10] Super Admin retrieving user list (GET /users)...');
    const adminUsersRes = await request('/users', 'GET', null, superAdminToken);
    if (adminUsersRes.status === 200) {
      console.log('✅ User list retrieved successfully!');
      console.log(`   Total Users: ${adminUsersRes.data.data.length}`);
      adminUsersRes.data.data.forEach(u => {
        console.log(`   - ID: ${u.id} | ${u.name} (${u.email}) | Status: ${u.status} | Created By: ${u.createdBy}`);
      });
    } else {
      throw new Error(`Super Admin failed to list users: ${JSON.stringify(adminUsersRes.data)}`);
    }

    // --- TEST 11: Super Admin creates custom Role ---
    console.log('\n[TEST 11] Super Admin creating a custom Role (Audit Manager)...');
    const newRoleRes = await request('/roles', 'POST', {
      name: 'Audit Manager',
      description: 'Audit log management and export access.',
      scope: 'AUDIT_MODULES',
      status: 'ACTIVE',
      permissions: [
        {
          moduleKey: 'reports',
          actions: ['view', 'export']
        }
      ]
    }, superAdminToken);

    if (newRoleRes.status === 201) {
      console.log('✅ Custom Role created successfully!');
      auditRoleId = newRoleRes.data.data.id;
    } else {
      throw new Error(`Failed to create custom role: ${JSON.stringify(newRoleRes.data)}`);
    }

    // --- TEST 12: Super Admin assigns the custom role to the user ---
    console.log('\n[TEST 12] Assigning Audit Manager role to John Doe...');
    const assignRoleRes = await request(`/users/${testUserId}`, 'PUT', {
      roleId: auditRoleId
    }, superAdminToken);

    if (assignRoleRes.status === 200) {
      console.log('✅ Role assigned successfully!');
    } else {
      throw new Error(`Failed to assign role to user: ${JSON.stringify(assignRoleRes.data)}`);
    }

    // --- TEST 13: Verify permissions updated ---
    console.log('\n[TEST 13] Fetching profile for John Doe to verify updated permissions...');
    const verifyMeRes = await request('/auth/me', 'GET', null, testUserToken);
    if (verifyMeRes.status === 200) {
      console.log(`   New Role: ${verifyMeRes.data.data.user.role.name}`);
      const perms = verifyMeRes.data.data.user.permissions;
      if (perms.reports && perms.reports.includes('export')) {
        console.log('✅ Permissions match the custom role setup!');
      } else {
        throw new Error('Permissions do not match the assigned Role matrix!');
      }
    } else {
      throw new Error(`Failed to fetch updated profile: ${JSON.stringify(verifyMeRes.data)}`);
    }

    console.log('\n==================================================');
    console.log('      🎉 ALL API INTEGRATION TESTS PASSED 🎉       ');
    console.log('==================================================\n');

  } catch (error) {
    console.error('\n❌ Test Suite Failed with error:');
    console.error(error.message || error);
    process.exitCode = 1;
  } finally {
    if (server) {
      server.close();
      console.log('[Test Teardown] Test server closed.');
    }
    await sequelize.close();
    console.log('[Test Teardown] Database connection closed.');
  }
}

runTests();
