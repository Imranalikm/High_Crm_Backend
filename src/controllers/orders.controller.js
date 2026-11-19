/**
 * Admin orders for all CRM MT5 accounts. READ-ONLY: only reads from the
 * gateway via utils/mt5Gateway (no cancel/modify).
 *
 *  - pending:  /Home/getPendingOrder/{login} for every CRM login (cached ~10s)
 *  - history:  executed orders from /Home/tradeHistoryByLoginTime
 */
const { gatewayRead, symbolInfo, crmAccounts, historyOrders, mapLimit, parseRange, ymd } = require('../utils/mt5Gateway');

const PENDING_CACHE_MS = Number(process.env.MT5_PENDING_CACHE_MS || 10000);
const PENDING_CONCURRENCY = 10;

// MT5 order types (numeric enum) -> label
const ORDER_TYPES = {
  0: 'BUY', 1: 'SELL', 2: 'BUY LIMIT', 3: 'SELL LIMIT', 4: 'BUY STOP', 5: 'SELL STOP',
  6: 'BUY STOP LIMIT', 7: 'SELL STOP LIMIT', 8: 'CLOSE BY',
};

// MT5 order reason (IMTOrder::EnOrderReason) -> where the order came from
const ORDER_REASONS = {
  0: 'Terminal', 1: 'Expert (EA)', 2: 'Dealer', 3: 'Stop Loss', 4: 'Take Profit', 5: 'Stop Out',
  6: 'Rollover', 7: 'External', 8: 'Variation Margin', 9: 'Gateway', 10: 'Signal', 11: 'Settlement',
  12: 'Transfer', 13: 'Sync', 14: 'External Service', 15: 'Migration', 16: 'Mobile', 17: 'Web', 18: 'Split',
};

const first = (o, keys) => {
  for (const k of keys) if (o[k] !== undefined && o[k] !== null && o[k] !== '') return o[k];
  return undefined;
};

const orderTypeLabel = (t) => {
  if (t === undefined) return '—';
  if (ORDER_TYPES[t] !== undefined) return ORDER_TYPES[t];
  return String(t).toUpperCase().replace(/^ORDER_TYPE_/, '').replace(/_/g, ' ');
};

const toLots = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  // Gateway REST reports lots (0.01); raw MT5 units are 1/10000 lot (100 = 0.01)
  return Number.isInteger(n) && n >= 100 ? n / 10000 : n;
};

const clientOf = (acc) => acc?.user?.name || acc?.contactName || null;

/* ── pending orders ───────────────────────────────────────── */
let pendingCache = { at: 0, data: null };
let pendingInFlight = null;
let loggedSample = false;

function normalizePending(o, login, acc) {
  if (!loggedSample) {
    loggedSample = true;
    console.log('[Orders] Sample pending order from gateway:', JSON.stringify(o).slice(0, 600));
  }
  const type = orderTypeLabel(first(o, ['type', 'orderType', 'action', 'Type']));
  return {
    orderId: String(first(o, ['orderId', 'orderid', 'order', 'ticket', 'id']) ?? ''),
    login: String(login),
    client: clientOf(acc),
    userId: acc?.userId || null,
    symbol: first(o, ['symbol', 'Symbol']) || '—',
    type,
    side: /SELL/.test(type) ? 'SELL' : 'BUY',
    lots: toLots(first(o, ['volume', 'volumeCurrent', 'initialVolume', 'volumeInitial'])),
    price: Number(first(o, ['price', 'priceOrder', 'orderPrice', 'openPrice'])) || null,
    priceTrigger: Number(first(o, ['priceTrigger', 'triggerPrice'])) || null,
    priceCurrent: Number(first(o, ['priceCurrent', 'currentPrice'])) || null,
    sl: Number(first(o, ['sl', 'stopLoss', 'priceSL'])) || null,
    tp: Number(first(o, ['tp', 'takeProfit', 'priceTP'])) || null,
    time: first(o, ['time', 'timeSetup', 'setupTime', 'openTime', 'createdAt']) || null,
    expiration: first(o, ['expiration', 'timeExpiration']) || null,
    comment: first(o, ['comment']) || '',
  };
}

async function sweepPending() {
  const byLogin = await crmAccounts();
  const logins = [...byLogin.keys()];
  let failed = 0;
  const lists = await mapLimit(logins, PENDING_CONCURRENCY, async (login) => {
    try {
      const data = await gatewayRead('get', `/Home/getPendingOrder/${encodeURIComponent(login)}`);
      return (data?.pendingOrders || []).map((o) => normalizePending(o, login, byLogin.get(login)));
    } catch (err) {
      if (err.response?.data?.retcode === 'MT_RET_ERR_NOTFOUND') return [];
      failed += 1;
      console.warn(`[Orders] getPendingOrder ${login} failed:`, err.response?.status || err.message);
      return [];
    }
  });
  return {
    orders: lists.flat().sort((a, b) => new Date(b.time || 0) - new Date(a.time || 0)),
    accountsChecked: logins.length,
    accountsFailed: failed,
    fetchedAt: new Date().toISOString(),
  };
}

/** GET /api/mt5-accounts/orders/pending */
const getPendingOrders = async (req, res) => {
  try {
    if (!pendingCache.data || Date.now() - pendingCache.at > PENDING_CACHE_MS) {
      if (!pendingInFlight) {
        pendingInFlight = sweepPending()
          .then((data) => { pendingCache = { at: Date.now(), data }; return data; })
          .finally(() => { pendingInFlight = null; });
      }
      await pendingInFlight;
    }
    return res.json({ success: true, data: pendingCache.data.orders, meta: { ...pendingCache.data, orders: undefined } });
  } catch (err) {
    console.error('[Orders] Pending sweep failed:', err.response?.data || err.message);
    return res.status(502).json({ success: false, message: 'Failed to load pending orders from MT5.' });
  }
};

/* ── order history (executed orders) ──────────────────────── */

/** GET /api/mt5-accounts/orders/history?from=YYYY-MM-DD&to=YYYY-MM-DD&login=123 */
const getOrderHistory = async (req, res) => {
  try {
    const range = parseRange(req.query);
    if (range.error) return res.status(400).json({ success: false, message: range.error });
    const { from, to } = range;

    const byLogin = await crmAccounts(req.query.login);
    const logins = [...byLogin.keys()].map(Number).filter(Number.isFinite);
    if (!logins.length) return res.json({ success: true, data: [], range: { from: ymd(from), to: ymd(to) } });

    const orders = await historyOrders(logins, from, to);

    const infos = new Map();
    await Promise.all([...new Set(orders.map((o) => o.symbol))].map(async (s) => infos.set(s, await symbolInfo(s))));

    const data = orders.map((o) => {
      const acc = byLogin.get(String(o.loginId));
      const digits = Number(infos.get(o.symbol)?.digits) || 5;
      const price = Number(o.currentPrice);
      const reason = Number(o.reason);
      return {
        orderId: String(o.orderId),
        positionId: String(o.positionId),
        login: String(o.loginId),
        client: clientOf(acc),
        userId: acc?.userId || null,
        symbol: o.symbol,
        side: o.type === 'SELL' ? 'SELL' : 'BUY',
        // the order that opened the position carries the position's id
        direction: String(o.orderId) === String(o.positionId) ? 'OPEN' : 'CLOSE',
        lots: Number(o.initialVolume) || 0,
        price: Number.isFinite(price) ? Math.round(price * 10 ** digits) / 10 ** digits : null,
        sl: Number(o.sl) || null,
        tp: Number(o.tp) || null,
        time: o.closeTime || o.openTime,
        source: ORDER_REASONS[reason] || (o.reason !== undefined ? `Code ${o.reason}` : '—'),
        comment: o.comment || '',
      };
    }).sort((a, b) => new Date(b.time) - new Date(a.time));

    return res.json({ success: true, data, range: { from: ymd(from), to: ymd(to) } });
  } catch (err) {
    console.error('[Orders] History failed:', err.response?.data || err.message);
    const gw = err.gatewayRetcode || err.response?.data?.retcode;
    return res.status(502).json({ success: false, message: gw ? `MT5 gateway: ${gw}` : 'Failed to load order history from MT5.' });
  }
};

module.exports = { getPendingOrders, getOrderHistory };
