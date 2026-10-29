const { DemoAccountSetting } = require('../models');

/**
 * Returns the single demo settings row (ID=1), creating it with defaults if missing
 */
async function getDemoSettingsRecord() {
  let settings = await DemoAccountSetting.findByPk(1);
  if (!settings) {
    settings = await DemoAccountSetting.create({ id: 1 });
  }
  return settings;
}

/**
 * Get demo account settings
 */
async function getDemoSettings(req, res, next) {
  try {
    const settings = await getDemoSettingsRecord();
    return res.status(200).json({ success: true, data: settings });
  } catch (error) {
    next(error);
  }
}

/**
 * Update demo account settings
 */
async function updateDemoSettings(req, res, next) {
  try {
    const { enabled, mt5GroupName, initialBalance, leverage, cooldownHours } = req.body;
    const updates = {};

    if (enabled !== undefined) {
      updates.enabled = Boolean(enabled);
    }

    if (mt5GroupName !== undefined) {
      const group = String(mt5GroupName).trim();
      if (!group) {
        return res.status(400).json({ success: false, message: 'MT5 demo group is required.' });
      }
      updates.mt5GroupName = group;
    }

    if (initialBalance !== undefined) {
      const balance = Number(initialBalance);
      if (!Number.isFinite(balance) || balance < 0 || balance > 10000000) {
        return res.status(400).json({ success: false, message: 'Initial balance must be between 0 and 10,000,000.' });
      }
      updates.initialBalance = balance;
    }

    if (leverage !== undefined) {
      if (!/^1:\d+$/.test(String(leverage))) {
        return res.status(400).json({ success: false, message: 'Leverage must be in the format 1:100.' });
      }
      updates.leverage = String(leverage);
    }

    if (cooldownHours !== undefined) {
      const hours = Number(cooldownHours);
      if (!Number.isInteger(hours) || hours < 0 || hours > 720) {
        return res.status(400).json({ success: false, message: 'Cooldown must be a whole number of hours between 0 and 720.' });
      }
      updates.cooldownHours = hours;
    }

    const settings = await getDemoSettingsRecord();
    await settings.update({ ...updates, updatedBy: req.user.id });

    return res.status(200).json({
      success: true,
      message: 'Demo account settings updated successfully.',
      data: settings
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getDemoSettingsRecord,
  getDemoSettings,
  updateDemoSettings
};
