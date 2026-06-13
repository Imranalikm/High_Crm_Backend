const axios = require('axios');
const { Mt5Group } = require('../models');
const { getToken, connectManager } = require('../utils/tokenFetch');

/**
 * Fetch groups from MT5 external API and store in our DB
 */
const fetchAndStoreMt5Groups = async (req, res, next) => {
  try {
    const token = await getToken();

    let response = await axios.get(`${process.env.EXTERNAL_API_BASE_URL}/Home/groupInfo/*`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      }
    });

    console.log("🛠️ INITIAL MT5 API RESPONSE:", typeof response.data === 'string' ? response.data : JSON.stringify(response.data));

    let { groupDeatails, message } = response.data;

    // Check if manager is not connected (case-insensitive)
    const responseDataStr = typeof response.data === 'string' 
      ? response.data.toLowerCase() 
      : JSON.stringify(response.data || {}).toLowerCase();
      
    const isManagerNotConnected = responseDataStr.includes('manager is not connected');

    if (isManagerNotConnected) {
      console.log('Manager not connected. Attempting login...');
      await connectManager(token);
      
      // Retry fetching groups
      response = await axios.get(`${process.env.EXTERNAL_API_BASE_URL}/Home/groupInfo/*`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        }
      });
      console.log("🛠️ RETRY MT5 API RESPONSE:", typeof response.data === 'string' ? response.data : JSON.stringify(response.data));
      groupDeatails = response.data.groupDeatails;
    }

    if (!groupDeatails || !Array.isArray(groupDeatails)) {
      console.error("🚨 CRITICAL: Invalid format from MT5 API.");
      console.error("🚨 EXPECTED { groupDeatails: [...] }");
      console.error("🚨 RECEIVED DATA:", typeof response.data === 'string' ? response.data : JSON.stringify(response.data));
      
      // If the response is actually an array itself, try parsing it
      if (Array.isArray(response.data)) {
         groupDeatails = response.data;
      } else if (response.data && Array.isArray(response.data.groupDetails)) {
         // Check if they spelled it correctly with 'groupDetails'
         groupDeatails = response.data.groupDetails;
      } else {
         return res.status(400).json({ success: false, message: 'Invalid response format from external API', debug: response.data });
      }
    }

    const savedGroups = [];

    for (const group of groupDeatails) {
      const { groupName } = group;

      if (!groupName) continue;

      const [mt5Group, created] = await Mt5Group.findOrCreate({
        where: { groupName },
        defaults: { groupName },
      });

      if (created) {
        savedGroups.push(mt5Group);
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Groups processed successfully',
      newGroupsAdded: savedGroups.length,
      data: savedGroups,
    });
  } catch (error) {
    console.error('Error fetching/storing groups:', error.message);
    next(error);
  }
};

/**
 * Get all MT5 groups from local database
 */
const getAllMt5Groups = async (req, res, next) => {
  try {
    const groups = await Mt5Group.findAll({
      order: [['groupName', 'ASC']],
      attributes: ['id', 'groupName'],
    });

    return res.status(200).json({
      success: true,
      count: groups.length,
      data: groups,
    });
  } catch (error) {
    console.error('getAllMt5Groups error:', error);
    next(error);
  }
};

module.exports = {
  fetchAndStoreMt5Groups,
  getAllMt5Groups
};
