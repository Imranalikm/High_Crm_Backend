const { User, Role, Module, RolePermission } = require('../models');
const { v4: uuidv4 } = require('uuid'); // We can use uuid or generate manually, but since we didn't add 'uuid' package, we can just generate a random UUID or use a static one. Let's use static UUIDs for predictability.

const ADMIN_ID = 1;

const defaultModules = [
  { name: 'Dashboard', key: 'dashboard', description: 'Dashboard overview and statistics' },
  { name: 'Users', key: 'users', description: 'User account management' },
  { name: 'Finance', key: 'finance', description: 'Financial transactions, payouts, and commissions' },
  { name: 'Trading', key: 'trading', description: 'Trading accounts, orders, and risk oversight' },
  { name: 'Copy Trading', key: 'copy_trading', description: 'Copy trading system controls and logs' },
  { name: 'Prop Trading', key: 'prop_trading', description: 'Prop challenge evaluation and accounts' },
  { name: 'IB System', key: 'ib_system', description: 'Introducing Broker network and rebates' },
  { name: 'Group Management', key: 'group_management', description: 'Trading group settings and leverage rules' },
  { name: 'Reports', key: 'reports', description: 'System reports and audit logs' },
  { name: 'Support Desk', key: 'support_desk', description: 'Customer support tickets and chats' },
  { name: 'Platform Settings', key: 'platform_settings', description: 'System and platform parameters' },
  { name: 'Admin Management', key: 'admin_management', description: 'Admin users, roles, and permissions configuration' }
];

const defaultRoles = [
  {
    name: 'Super Admin',
    key: 'super_admin',
    description: 'Full unrestricted access to all modules and system settings.',
    scope: 'ALL_MODULES',
    status: 'ACTIVE'
  },
  {
    name: 'Risk Officer',
    key: 'risk_officer',
    description: 'Access to risk management, trading oversight, and compliance monitoring.',
    scope: 'RISK_MODULES',
    status: 'ACTIVE'
  },
  {
    name: 'Compliance',
    key: 'compliance',
    description: 'KYC, AML, document review, and regulatory reporting access.',
    scope: 'COMPLIANCE_MODULES',
    status: 'ACTIVE'
  },
  {
    name: 'Finance',
    key: 'finance',
    description: 'Finance, payouts, commissions, and transaction review.',
    scope: 'FINANCE_MODULES',
    status: 'ACTIVE'
  },
  {
    name: 'Support Agent',
    key: 'support_agent',
    description: 'User-facing support, ticket management, and view access.',
    scope: 'SUPPORT_MODULES',
    status: 'ACTIVE'
  },
  {
    name: 'Read Only',
    key: 'read_only',
    description: 'View-only access to all non-sensitive modules.',
    scope: 'VIEW_ONLY',
    status: 'DRAFT'
  }
];

async function seedDatabase() {
  const transaction = await User.sequelize.transaction();
  try {
    console.log('[Seeder] Checking if database seeding is required...');

    // 1. Create or retrieve Super Admin User to resolve audit requirements
    let admin = await User.findByPk(ADMIN_ID, { transaction });
    if (!admin) {
      console.log('[Seeder] Creating default Super Admin user...');
      admin = await User.create({
        id: ADMIN_ID,
        name: 'Super Admin',
        email: 'admin@highcrm.com',
        password: 'AdminPassword123!', // will be hashed automatically by user hooks
        status: 'active',
        createdBy: ADMIN_ID,
        updatedBy: ADMIN_ID
      }, { transaction });
    }

    // 2. Seed Modules
    console.log('[Seeder] Seeding modules...');
    const dbModules = {};
    for (const m of defaultModules) {
      let [dbMod] = await Module.findOrCreate({
        where: { key: m.key },
        defaults: {
          ...m,
          createdBy: ADMIN_ID,
          updatedBy: ADMIN_ID
        },
        transaction
      });
      dbModules[m.key] = dbMod;
    }

    // 3. Seed Roles
    console.log('[Seeder] Seeding roles...');
    const dbRoles = {};
    for (const r of defaultRoles) {
      let [dbRole] = await Role.findOrCreate({
        where: { key: r.key },
        defaults: {
          ...r,
          createdBy: ADMIN_ID,
          updatedBy: ADMIN_ID
        },
        transaction
      });
      dbRoles[r.key] = dbRole;
    }

    // 4. Update Admin user's role to Super Admin
    if (admin.roleId !== dbRoles['super_admin'].id) {
      await admin.update({ roleId: dbRoles['super_admin'].id }, { transaction });
    }

    // Sync the auto-increment identity sequence for the users table to prevent collision with manually seeded ID 1
    await User.sequelize.query(
      "SELECT setval(pg_get_serial_sequence('users', 'id'), COALESCE((SELECT MAX(id) FROM users), 1));",
      { transaction }
    );

    // 5. Seed Permissions Matrix
    console.log('[Seeder] Seeding permissions matrix...');
    
    // Actions definition
    const allActions = ['view', 'create', 'edit', 'approve', 'delete', 'export', 'assign'];

    // Define permission mapping per role
    // Super Admin gets all actions on all modules
    const permissionsMap = {
      super_admin: {
        modules: Object.keys(dbModules),
        actions: allActions
      },
      risk_officer: {
        modules: ['dashboard', 'users', 'trading', 'copy_trading', 'prop_trading', 'reports'],
        actions: ['view', 'edit', 'approve', 'export']
      },
      compliance: {
        modules: ['dashboard', 'users', 'reports', 'admin_management'],
        actions: ['view', 'create', 'edit', 'approve', 'export']
      },
      finance: {
        modules: ['dashboard', 'finance', 'reports', 'support_desk'],
        actions: ['view', 'create', 'edit', 'approve', 'export']
      },
      support_agent: {
        modules: ['dashboard', 'users', 'support_desk'],
        actions: ['view', 'create', 'edit']
      },
      read_only: {
        modules: ['dashboard', 'trading', 'reports'],
        actions: ['view', 'export']
      }
    };

    for (const [roleKey, mapping] of Object.entries(permissionsMap)) {
      const role = dbRoles[roleKey];
      for (const moduleKey of mapping.modules) {
        const mod = dbModules[moduleKey];
        if (!mod) continue;

        for (const action of mapping.actions) {
          await RolePermission.findOrCreate({
            where: {
              roleId: role.id,
              moduleId: mod.id,
              action: action
            },
            defaults: {
              createdBy: ADMIN_ID,
              updatedBy: ADMIN_ID
            },
            transaction
          });
        }
      }
    }

    await transaction.commit();
    console.log('[Seeder] Seeding completed successfully!');
  } catch (error) {
    await transaction.rollback();
    console.error('[Seeder] Seeding failed:', error);
    throw error;
  }
}

module.exports = seedDatabase;
