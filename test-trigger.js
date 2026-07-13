const { User, Role, AppNotification } = require('./src/models');
const { getIo, initSocket } = require('./src/config/socket');

async function testTrigger() {
  try {
    const admins = await User.findAll({
      include: [{
        model: Role,
        as: 'role',
        where: {
          type: 'admin'
        }
      }]
    });

    console.log(`Found ${admins.length} admins`);

    const notifications = admins.map(admin => ({
      userId: admin.id,
      title: 'New User Registration',
      message: `A new user (Test User) has registered and is pending.`,
      type: 'registration',
      isRead: false
    }));

    const createdNotifications = await AppNotification.bulkCreate(notifications);
    console.log(`Created ${createdNotifications.length} notifications`);

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

testTrigger();
