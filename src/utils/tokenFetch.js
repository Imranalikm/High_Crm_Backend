const axios = require('axios');

const getToken = async () => {
  try {
    const response = await axios.post(`${process.env.EXTERNAL_API_BASE_URL}/Home/token`, {
      userName: process.env.EXTERNAL_API_USERNAME,
      password: process.env.EXTERNAL_API_PASSWORD,
    });
    
    // The structure returned by your external API may vary slightly. Assuming response.data.token is correct based on provided code.
    const token = response.data.token || response.data; 
    return token;
  } catch (error) {
    console.error("❌ Error fetching token:", error.message);
    throw new Error("Failed to fetch external API token");
  }
};

const connectManager = async (token) => {
  try {
    const response = await axios.post(`${process.env.EXTERNAL_API_BASE_URL}/Home/login`, {
      mngId: Number(process.env.EXTERNAL_API_MNG_ID || 0),
      pwd: process.env.EXTERNAL_API_MNG_PWD,
      srvIp: process.env.EXTERNAL_API_SRV_IP
    }, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      }
    });
    
    // The structure depends on the API. Just checking if it threw an error.
    console.log("🛠️ Manager connection response:", response.data);
    return true;
  } catch (error) {
    console.error("❌ Error connecting manager:", error.message);
    throw new Error("Failed to connect external API manager");
  }
};

module.exports = {
  getToken,
  connectManager
};
