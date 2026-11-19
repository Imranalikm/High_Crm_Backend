/**
 * READ-ONLY helpers for the MT5 gateway, used by the admin trading pages.
 *
 * Only endpoints that read data are allowed here. Anything that changes MT5
 * state (orderCancel, orderUpdate, sendOpenTrade, balanceOp, ...) must NOT be
 * added to this file.
 */
const axios = require('axios');
const { Op } = require('sequelize');
const { Mt5Account, User } = require('../models');
const { getToken, connectManager } = require('./tokenFetch');

const READ_ONLY_PATHS = [
  /^\/Home\/getPendingOrder\/[^/]+$/,
  /^\/Home\/tradeHistoryByLoginTime$/, // POST, but it only queries
  /^\/Home\/getSymbolInfo\/[^/]+$/,
];

const LOGIN_CHUNK = 200;
const SYMBOL_TTL_MS = 60 * 60 * 1000;
const symbolCache = new Map(); // symbol -> { at, info }

/** Call a read-only gateway endpoint; connects the manager once if needed. */
async function gatewayRead(method, path, body) {
  if (!READ_ONLY_PATHS.some((re) => re.test(path))) {
    throw new Error(`mt5Gateway: ${path} is not an allowed read-only endpoint`);
  }
  const token = await getToken();
  const url = `${process.env.EXTERNAL_API_BASE_URL}${path}`;
  const cfg = { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, timeout: 20000 };
  const run = () => (method === 'get' ? axios.get(url, cfg) : axios.post(url, body, cfg));
  try {
    return (await run()).data;
  } catch (err) {
    if (JSON.stringify(err.response?.data || '').toLowerCase().includes('manager is not connected')) {
      await connectManager(token);
      return (await run()).data;
    }
    throw err;
  }
}

async function symbolInfo(symbol) {
  const hit = symbolCache.get(symbol);
  if (hit && Date.now() - hit.at < SYMBOL_TTL_MS) return hit.info;
  let info = null;
  try {
    const data = await gatewayRead('get', `/Home/getSymbolInfo/${encodeURIComponent(symbol)}`);
    info = data?.symbol || null;
  } catch (err) {
    console.warn(`[mt5Gateway] getSymbolInfo ${symbol} failed:`, err.response?.status || err.message);
  }
  symbolCache.set(symbol, { at: Date.now(), info });
  return info;
}

/** Provisioned CRM accounts (optionally one login), with owner name. */
async function crmAccounts(login, userId) {
  const where = { accountid: { [Op.notLike]: 'PENDING-%' }, status: 'LIVE' };
  if (login) where.accountid = String(login);
  if (userId) where.userId = Number(userId);
  const rows = await Mt5Account.findAll({
    where,
    attributes: ['accountid', 'userId', 'accountType', 'contactName', 'groupName'],
    include: [{ model: User, as: 'user', attributes: ['id', 'name', 'email'] }],
  });
  return new Map(rows.map((a) => [String(a.accountid), a]));
}

const ymd = (d) => d.toISOString().slice(0, 10);

/** Executed orders for the given logins and date range (gateway history). */
async function historyOrders(logins, from, to) {
  const orders = [];
  for (let i = 0; i < logins.length; i += LOGIN_CHUNK) {
    let data;
    try {
      data = await gatewayRead('post', '/Home/tradeHistoryByLoginTime', {
        loginIds: logins.slice(i, i + LOGIN_CHUNK),
        startDate: ymd(from),
        endDate: ymd(to),
      });
    } catch (err) {
      if (err.response?.data?.retcode === 'MT_RET_ERR_NOTFOUND') continue; // no trades in range
      throw err;
    }
    if (data?.retcode === 'MT_RET_ERR_NOTFOUND') continue;
    if (data?.retcode && data.retcode !== 'MT_RET_OK') {
      const e = new Error(`MT5 gateway: ${data.retcode}`);
      e.gatewayRetcode = data.retcode;
      throw e;
    }
    orders.push(...(data?.tradeHistory || []));
  }
  return orders;
}

/** Run async fn over items with limited concurrency. */
async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}

/** Parse ?from=&to= (YYYY-MM-DD), default last `days` days, max `maxDays`. */
function parseRange(query, days = 30, maxDays = 366) {
  const to = query.to ? new Date(query.to) : new Date();
  const from = query.from ? new Date(query.from) : new Date(to.getTime() - days * 86400000);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) {
    return { error: 'Invalid date range. Use YYYY-MM-DD.' };
  }
  if ((to - from) / 86400000 > maxDays) return { error: `Date range cannot exceed ${maxDays} days.` };
  return { from, to };
}

module.exports = { gatewayRead, symbolInfo, crmAccounts, historyOrders, mapLimit, parseRange, ymd };
