const axios = require('axios');
const { getToken, connectManager } = require('./tokenFetch');

/**
 * Credit (positive amount) or debit (negative amount) an MT5 account balance
 * via the gateway balanceOP endpoint. Throws on gateway/network errors.
 * @returns {{ dealId: string|null, data: object }}
 */
async function mt5BalanceOperation(loginid, amount, comment = '') {
  const token = await getToken();
  const mt5Url = `${process.env.EXTERNAL_API_BASE_URL}/Home/balanceOP`;
  const payload = {
    loginid: Number(loginid),
    amount: Number(amount),
    txnType: 0,
    description: comment,
    comment
  };
  const config = { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } };

  let response;
  try {
    response = await axios.post(mt5Url, payload, config);
  } catch (err) {
    if (err.response && JSON.stringify(err.response.data).toLowerCase().includes('manager is not connected')) {
      console.log('Manager not connected. Attempting login...');
      await connectManager(token);
      response = await axios.post(mt5Url, payload, config);
    } else {
      throw err;
    }
  }

  console.log('[MT5 balanceOP] Response:', response.data);
  return {
    dealId: response.data?.dealID ? String(response.data.dealID) : null,
    data: response.data
  };
}

module.exports = { mt5BalanceOperation };
