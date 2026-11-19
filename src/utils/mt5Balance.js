const axios = require('axios');
const { getToken, connectManager } = require('./tokenFetch');

// Gateway TxnType enum (see /swagger BalanceOP.transactionType)
const TXN = Object.freeze({
  DEPOSIT: 0,
  WITHDRAWAL: 1,
  CREDIT: 2,
  CHARGE: 3,
  CORRECTION: 4,
  BONUS: 5,
  COMMISSION: 6,
  TAX: 7,
  DIVIDEND: 8,
  DIVIDEND_FRANKED: 9,
});

/**
 * Post a balance operation to an MT5 account via the gateway balanceOP endpoint.
 *
 * - Without `transactionType`: a positive amount is a Deposit (0), a negative
 *   amount a Withdrawal (1). Both are sent as a positive amount; the type sets
 *   the direction.
 * - With an explicit Deposit/Withdrawal type the amount is also sent positive.
 * - Any other type (Credit, Bonus, Charge, ...) is sent as given.
 *
 * Throws on gateway/network errors.
 * @returns {{ dealId: string|null, data: object }}
 */
async function mt5BalanceOperation(loginid, amount, comment = '', transactionType) {
  const token = await getToken();
  const mt5Url = `${process.env.EXTERNAL_API_BASE_URL}/Home/balanceOP`;
  const value = Number(amount);
  const type = transactionType ?? (value < 0 ? TXN.WITHDRAWAL : TXN.DEPOSIT);
  const payload = {
    loginid: Number(loginid),
    amount: type === TXN.DEPOSIT || type === TXN.WITHDRAWAL ? Math.abs(value) : value,
    transactionType: type,
    comment: String(comment || '').slice(0, 31), // MT5 deal comments are 32 chars max
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

  console.log('[MT5 balanceOP] Request:', payload, 'Response:', response.data);

  // The gateway can answer 200 with an MT5 error code in the body
  const body = typeof response.data === 'string' ? response.data : JSON.stringify(response.data || '');
  if (/MT_RET_(?!OK|REQUEST_DONE)|not connected|invalid|fail/i.test(body) && !response.data?.dealID) {
    const err = new Error(`MT5 rejected the balance operation: ${body.slice(0, 200)}`);
    err.response = { data: response.data, status: response.status };
    throw err;
  }

  return {
    dealId: response.data?.dealID ? String(response.data.dealID) : null,
    data: response.data
  };
}

module.exports = { mt5BalanceOperation, TXN };
