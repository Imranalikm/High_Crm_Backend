/**
 * MT5 live stream bridge.
 *
 * Holds ONE upstream WebSocket per MT5 gateway feed (scope "all"):
 *   - /ws/accounts  -> balance, equity, margin ...  (per login)
 *   - /ws/positions -> open positions                (per position)
 * keeps the latest state in memory, and fans updates out over Socket.IO:
 *   - "admin_room"      -> everything for accounts that exist in our mt5_accounts table
 *   - "user_<userId>"   -> account updates for that user's own logins
 *
 * The gateway token never leaves the backend.
 */
const { Op } = require('sequelize');
const { getToken } = require('../utils/tokenFetch');
const { getIo } = require('../config/socket');
const { Mt5Account } = require('../models');

const WS_BASE = (process.env.MT5_WS_URL || 'ws://144.91.127.72:6969/ws/accounts').replace(/\/ws\/.*$/, '');
const ACCOUNTS_URL = `${WS_BASE}/ws/accounts`;
const POSITIONS_URL = process.env.MT5_WS_POSITIONS_URL || `${WS_BASE}/ws/positions`;

const FLUSH_MS = Number(process.env.MT5_WS_FLUSH_MS || 1000);              // batch interval to browsers
const OWNERS_REFRESH_MS = 60 * 1000;                                        // reload login -> user map
const PERSIST_MS = Number(process.env.MT5_WS_PERSIST_MS || 30 * 1000);      // write changed balances to DB
// Feeds only send on change, so a quiet market is normal. Only treat very long
// silence as a dead (half-open) connection; real drops are caught by onclose.
const STALE_MS = 10 * 60 * 1000;

/* ── shared state ─────────────────────────────────────────── */
const owners = new Map(); // login -> userId|null (only logins that exist in our DB)

// accounts
const latest = new Map();          // login -> last account payload
let pendingAccounts = new Map();   // login -> payload waiting to be flushed
const dirtyBalances = new Map();   // login -> balance to persist

// positions
const positions = new Map();       // positionId -> position
let pendingPosUpserts = new Map(); // positionId -> position
let pendingPosRemovals = new Set();// positionId
let positionsReset = false;        // tell admins to drop their list (after reconnect)
const unknownPositionTypes = new Set();

let started = false;

/* ── helpers ──────────────────────────────────────────────── */
const ioOrNull = () => { try { return getIo(); } catch { return null; } };

async function refreshOwners() {
  try {
    const rows = await Mt5Account.findAll({
      attributes: ['accountid', 'userId'],
      where: { accountid: { [Op.notLike]: 'PENDING-%' } },
      raw: true,
    });
    owners.clear();
    rows.forEach((r) => owners.set(String(r.accountid), r.userId || null));
  } catch (err) {
    console.error('[MT5 Stream] Failed to refresh account owners:', err.message);
  }
}

const shapeAccount = (m) => ({
  login: String(m.login),
  balance: m.balance,
  credit: m.credit,
  equity: m.equity,
  margin: m.margin,
  marginFree: m.marginFree,
  marginLevel: m.marginLevel,
  profit: m.profit,
  floating: m.floating,
  time: m.time,
});

// MT5 volume is in 1/10000 lot; action 0 = buy, 1 = sell
const shapePosition = (m) => ({
  positionId: String(m.positionId),
  login: String(m.login),
  symbol: m.symbol,
  side: String(m.action) === '1' ? 'SELL' : 'BUY',
  volume: m.volume,
  lots: Number(m.volume) / 10000,
  priceOpen: m.priceOpen,
  priceCurrent: m.priceCurrent,
  profit: m.profit,
  stopLoss: m.stopLoss,
  takeProfit: m.takeProfit,
  time: m.time,
});

/* ── generic feed connection with reconnect ───────────────── */
function createFeed({ name, url, onMessage, onOpen, onDown }) {
  const feed = { name, connected: false, ws: null, retryMs: 1000, lastMessageAt: 0 };

  const setConnected = (value) => {
    if (feed.connected === value) return;
    feed.connected = value;
    const io = ioOrNull();
    if (io) io.to('admin_room').emit('mt5:status', status());
  };

  const scheduleReconnect = () => {
    const delay = feed.retryMs;
    feed.retryMs = Math.min(feed.retryMs * 2, 30000);
    console.warn(`[MT5 Stream:${name}] Reconnecting in ${delay}ms`);
    setTimeout(() => connect().catch((e) => {
      console.error(`[MT5 Stream:${name}] Connect failed:`, e.message);
      scheduleReconnect();
    }), delay);
  };

  async function connect() {
    const token = await getToken(); // fresh token on every (re)connect
    const socket = new WebSocket(`${url}?access_token=${encodeURIComponent(typeof token === 'string' ? token : '')}`);
    feed.ws = socket;

    socket.onopen = () => {
      feed.retryMs = 1000;
      feed.lastMessageAt = Date.now();
      onOpen?.();
      socket.send(JSON.stringify({ action: 'subscribe', scope: 'all' }));
      console.log(`[MT5 Stream:${name}] Connected`);
      setConnected(true);
    };

    socket.onmessage = ({ data }) => {
      feed.lastMessageAt = Date.now();
      let msg;
      try { msg = JSON.parse(data); } catch { return; }
      if (msg.type === 'status') {
        if (msg.mt5Connected === false) console.warn(`[MT5 Stream:${name}] Gateway reports MT5 disconnected`);
        return;
      }
      onMessage(msg);
    };

    socket.onerror = (e) => {
      console.error(`[MT5 Stream:${name}] Socket error:`, e?.message || e?.type || 'unknown');
    };

    socket.onclose = (e) => {
      if (feed.ws !== socket) return; // an older socket closing after we replaced it
      feed.ws = null;
      setConnected(false);
      onDown?.();
      console.warn(`[MT5 Stream:${name}] Closed (${e.code}${e.reason ? ` ${e.reason}` : ''})`);
      scheduleReconnect();
    };
  }

  feed.start = () => connect().catch((e) => {
    console.error(`[MT5 Stream:${name}] Initial connect failed:`, e.message);
    scheduleReconnect();
  });

  feed.checkStale = () => {
    if (feed.ws && feed.ws.readyState === WebSocket.OPEN && Date.now() - feed.lastMessageAt > STALE_MS) {
      console.warn(`[MT5 Stream:${name}] No data for ${STALE_MS / 60000} min, forcing reconnect`);
      feed.ws.close(); // onclose schedules the reconnect
    }
  };

  return feed;
}

/* ── accounts feed ────────────────────────────────────────── */
const accountsFeed = createFeed({
  name: 'accounts',
  url: ACCOUNTS_URL,
  onMessage: (msg) => {
    if (msg.type !== 'account' || msg.login == null) return;
    const login = String(msg.login);
    if (!owners.has(login)) return; // ignore accounts not managed by this CRM
    const acc = shapeAccount(msg);
    const prev = latest.get(login);
    latest.set(login, acc);
    pendingAccounts.set(login, acc);
    if (!prev || prev.balance !== acc.balance) dirtyBalances.set(login, acc.balance);
  },
});

/* ── positions feed ───────────────────────────────────────── */
function removePosition(id) {
  if (!positions.delete(id)) return;
  pendingPosUpserts.delete(id);
  pendingPosRemovals.add(id);
}

const positionsFeed = createFeed({
  name: 'positions',
  url: POSITIONS_URL,
  // The gateway re-sends a snapshot on every subscribe, so start from a clean
  // slate: positions closed while we were disconnected must not linger.
  onOpen: () => {
    positions.clear();
    pendingPosUpserts = new Map();
    pendingPosRemovals = new Set();
    positionsReset = true;
  },
  onMessage: (msg) => {
    const type = String(msg.type || '');
    if (!type.startsWith('position') || msg.positionId == null) return;
    const id = String(msg.positionId);

    const isRemoval = /delete|remove|close/i.test(type) || Number(msg.volume) === 0;
    if (isRemoval) return removePosition(id);

    const isUpsert = /snapshot|add|open|update|modify|change/i.test(type) || type === 'position';
    if (!isUpsert) {
      if (!unknownPositionTypes.has(type)) {
        unknownPositionTypes.add(type);
        console.warn(`[MT5 Stream:positions] Unhandled message type "${type}":`, JSON.stringify(msg).slice(0, 300));
      }
      return;
    }

    if (!owners.has(String(msg.login))) return; // only this CRM's accounts
    const pos = shapePosition(msg);
    positions.set(id, pos);
    pendingPosRemovals.delete(id);
    pendingPosUpserts.set(id, pos);
  },
});

/* ── fan-out to browsers ──────────────────────────────────── */
function flush() {
  const io = ioOrNull();
  if (!io) return;

  if (pendingAccounts.size) {
    const batch = [...pendingAccounts.values()];
    pendingAccounts = new Map();
    io.to('admin_room').emit('mt5:accounts', batch);

    const byUser = new Map();
    for (const acc of batch) {
      const userId = owners.get(acc.login);
      if (!userId) continue;
      if (!byUser.has(userId)) byUser.set(userId, []);
      byUser.get(userId).push(acc);
    }
    for (const [userId, list] of byUser) io.to(`user_${userId}`).emit('mt5:accounts', list);
  }

  if (positionsReset || pendingPosUpserts.size || pendingPosRemovals.size) {
    io.to('admin_room').emit('mt5:positions', {
      reset: positionsReset,
      upsert: positionsReset ? [...positions.values()] : [...pendingPosUpserts.values()],
      remove: [...pendingPosRemovals],
    });
    positionsReset = false;
    pendingPosUpserts = new Map();
    pendingPosRemovals = new Set();
  }
}

async function persistBalances() {
  if (!dirtyBalances.size) return;
  const entries = [...dirtyBalances.entries()];
  dirtyBalances.clear();
  for (const [login, balance] of entries) {
    try {
      await Mt5Account.update({ balance }, { where: { accountid: login } });
    } catch (err) {
      console.error(`[MT5 Stream] Failed to persist balance for ${login}:`, err.message);
    }
  }
}

/* ── public API ───────────────────────────────────────────── */

/**
 * Overlay live MT5 values onto an account record (plain object with
 * `accountid`). Leaves the stored values when no live data has arrived.
 */
function withLive(acc) {
  const live = acc && latest.get(String(acc.accountid));
  if (!live) return { ...acc, isLive: false };
  return {
    ...acc,
    balance: live.balance,
    equity: live.equity,
    credit: live.credit,
    margin: live.margin,
    marginFree: live.marginFree,
    marginLevel: live.marginLevel,
    floating: live.floating,
    profit: live.profit,
    liveTime: live.time,
    isLive: true,
  };
}

/** Live balance for a login, or null when the feed has no data for it. */
function liveBalance(login) {
  const live = latest.get(String(login));
  return live && Number.isFinite(Number(live.balance)) ? Number(live.balance) : null;
}
const isStaff = (user) => !!(user?.role && user.role.type !== 'user');

/** Account snapshot a given socket user is allowed to see. */
function snapshotFor(user) {
  const all = [...latest.values()];
  if (isStaff(user)) return all;
  return all.filter((a) => owners.get(a.login) === user.id);
}

/** Full open-positions list (staff only). */
function positionsSnapshotFor(user) {
  return isStaff(user) ? [...positions.values()] : [];
}

function status() {
  return {
    connected: accountsFeed.connected,
    accounts: accountsFeed.connected,
    positions: positionsFeed.connected,
  };
}

async function start() {
  if (started) return;
  started = true;
  if (typeof WebSocket === 'undefined') {
    console.error('[MT5 Stream] Global WebSocket not available (needs Node 22+). Live MT5 data disabled.');
    return;
  }
  await refreshOwners();
  setInterval(refreshOwners, OWNERS_REFRESH_MS);
  setInterval(flush, FLUSH_MS);
  setInterval(() => persistBalances().catch(() => {}), PERSIST_MS);
  setInterval(() => { accountsFeed.checkStale(); positionsFeed.checkStale(); }, 60 * 1000);
  accountsFeed.start();
  positionsFeed.start();
}

module.exports = {
  start,
  refreshOwners,
  snapshotFor,
  positionsSnapshotFor,
  withLive,
  liveBalance,
  /** Latest live payload for one login, or undefined if none received yet. */
  liveFor: (login) => latest.get(String(login)),
  isConnected: () => accountsFeed.connected,
  status,
};
