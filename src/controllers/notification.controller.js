const { NotificationSetting, NotificationTemplate, AppNotification } = require('../models');

/**
 * Get notification settings (returns the single row with ID=1, creating it if it doesn't exist)
 */
async function getNotificationConfig(req, res, next) {
  try {
    let config = await NotificationSetting.findByPk(1);
    if (!config) {
      config = await NotificationSetting.create({ id: 1 });
    }
    return res.status(200).json({
      success: true,
      data: config
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Update notification settings
 */
async function updateNotificationConfig(req, res, next) {
  try {
    let config = await NotificationSetting.findByPk(1);
    if (!config) {
      config = await NotificationSetting.create({ id: 1 });
    }
    await config.update(req.body);
    return res.status(200).json({
      success: true,
      message: 'Notification settings updated successfully.',
      data: config
    });
  } catch (error) {
    next(error);
  }
}

/**
 * List all notification templates
 */
async function getTemplates(req, res, next) {
  try {
    const templates = await NotificationTemplate.findAll({
      order: [['name', 'ASC']]
    });
    return res.status(200).json({
      success: true,
      data: templates
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get details of a single template by ID
 */
async function getTemplateById(req, res, next) {
  try {
    const template = await NotificationTemplate.findByPk(req.params.id);
    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Template not found.'
      });
    }
    return res.status(200).json({
      success: true,
      data: template
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Create a new notification template
 */
async function createTemplate(req, res, next) {
  try {
    const { name, event, subject, body, status, type } = req.body;
    if (!name || !event || !subject || !body) {
      return res.status(400).json({
        success: false,
        message: 'Name, event, subject, and body are required.'
      });
    }

    const existing = await NotificationTemplate.findOne({ where: { event } });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: `Template for event '${event}' already exists.`
      });
    }

    const template = await NotificationTemplate.create({
      name,
      event,
      subject,
      body,
      status: status || 'ACTIVE',
      type: type || 'email'
    });

    return res.status(201).json({
      success: true,
      message: 'Template created successfully.',
      data: template
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Update an existing template by ID
 */
async function updateTemplate(req, res, next) {
  try {
    const template = await NotificationTemplate.findByPk(req.params.id);
    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Template not found.'
      });
    }

    await template.update(req.body);
    return res.status(200).json({
      success: true,
      message: 'Template updated successfully.',
      data: template
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Delete a template by ID
 */
async function deleteTemplate(req, res, next) {
  try {
    const template = await NotificationTemplate.findByPk(req.params.id);
    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Template not found.'
      });
    }

    await template.destroy();
    return res.status(200).json({
      success: true,
      message: 'Template deleted successfully.'
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get unread app notifications for the current user
 */
async function getUnreadNotifications(req, res, next) {
  try {
    const notifications = await AppNotification.findAll({
      where: {
        userId: req.user.id,
        isRead: false
      },
      order: [['createdAt', 'DESC']],
      limit: 10
    });

    return res.status(200).json({
      success: true,
      data: notifications
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Mark a specific notification as read
 */
async function markAsRead(req, res, next) {
  try {
    const { id } = req.params;

    const notification = await AppNotification.findOne({
      where: {
        id,
        userId: req.user.id
      }
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    notification.isRead = true;
    notification.readAt = new Date();
    await notification.save();

    return res.status(200).json({
      success: true,
      message: 'Notification marked as read'
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Mark all notifications as read for current user
 */
async function markAllAsRead(req, res, next) {
  try {
    await AppNotification.update(
      { isRead: true, readAt: new Date() },
      { where: { userId: req.user.id, isRead: false } }
    );

    return res.status(200).json({
      success: true,
      message: 'All notifications marked as read'
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getNotificationConfig,
  updateNotificationConfig,
  getTemplates,
  getTemplateById,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  getUnreadNotifications,
  markAsRead,
  markAllAsRead
};
