const { CrmGroup } = require('../models');

// Create a new CRM Group
const createCrmGroup = async (req, res, next) => {
  try {
    const numericFields = ['minFirstDeposit', 'minDeposit', 'minWithdrawal', 'perProfileMaxAccount', 'firstDeposit', 'maxWithdrawalPerDay', 'spreadStartFrom'];
    numericFields.forEach(field => {
      if (req.body[field] === '') req.body[field] = null;
    });

    const {
      name,
      mt5GroupName,
      groupStatus,
      groupType,
      currencyUnit,
      minFirstDeposit,
      minDeposit,
      minWithdrawal,
      perProfileMaxAccount,
      firstDeposit,
      maxWithdrawalPerDay,
      spreadStartFrom,
      accountOpenPolicy,
      depositPolicy,
      withdrawalPolicy,
      tradingType,
      maxLeverage
    } = req.body;

    const existingGroup = await CrmGroup.findOne({ where: { name } });
    if (existingGroup) {
      return res.status(400).json({ success: false, message: 'Group name already exists.' });
    }

    const group = await CrmGroup.create({
      name,
      mt5GroupName,
      groupStatus,
      groupType,
      currencyUnit,
      minFirstDeposit,
      minDeposit,
      minWithdrawal,
      perProfileMaxAccount,
      firstDeposit,
      maxWithdrawalPerDay,
      spreadStartFrom,
      accountOpenPolicy,
      depositPolicy,
      withdrawalPolicy,
      tradingType,
      maxLeverage,
      createdBy: req.user.id
    });

    return res.status(201).json({ success: true, message: 'CRM Group created successfully', data: group });
  } catch (error) {
    console.error('Error creating CRM Group:', error);
    next(error);
  }
};

// Get all non-deleted CRM Groups
const getAllCrmGroups = async (req, res, next) => {
  try {
    const groups = await CrmGroup.findAll({
      where: { isDeleted: false },
      order: [['createdAt', 'DESC']]
    });

    return res.status(200).json({ success: true, count: groups.length, data: groups });
  } catch (error) {
    console.error('Error fetching CRM Groups:', error);
    next(error);
  }
};

// Update an existing CRM Group
const updateCrmGroup = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const numericFields = ['minFirstDeposit', 'minDeposit', 'minWithdrawal', 'perProfileMaxAccount', 'firstDeposit', 'maxWithdrawalPerDay', 'spreadStartFrom'];
    numericFields.forEach(field => {
      if (req.body[field] === '') req.body[field] = null;
    });

    const group = await CrmGroup.findOne({ where: { id, isDeleted: false } });
    if (!group) {
      return res.status(404).json({ success: false, message: 'CRM Group not found.' });
    }

    // Check name collision if name is being changed
    if (req.body.name && req.body.name !== group.name) {
      const existing = await CrmGroup.findOne({ where: { name: req.body.name } });
      if (existing) {
        return res.status(400).json({ success: false, message: 'Group name already exists.' });
      }
    }

    await group.update({
      ...req.body,
      updatedBy: req.user.id
    });

    return res.status(200).json({ success: true, message: 'CRM Group updated successfully', data: group });
  } catch (error) {
    console.error('Error updating CRM Group:', error);
    next(error);
  }
};

// Soft delete a CRM Group
const softDeleteCrmGroup = async (req, res, next) => {
  try {
    const { id } = req.params;

    const group = await CrmGroup.findOne({ where: { id, isDeleted: false } });
    if (!group) {
      return res.status(404).json({ success: false, message: 'CRM Group not found.' });
    }

    await group.update({
      isDeleted: true,
      updatedBy: req.user.id
    });

    return res.status(200).json({ success: true, message: 'CRM Group deleted successfully' });
  } catch (error) {
    console.error('Error deleting CRM Group:', error);
    next(error);
  }
};

module.exports = {
  createCrmGroup,
  getAllCrmGroups,
  updateCrmGroup,
  softDeleteCrmGroup
};
