/**
 * Admin trade history (closed positions) for all CRM MT5 accounts. READ-ONLY.
 *
 * The gateway's /Home/tradeHistoryByLoginTime returns ORDERS, not deals:
 * each position has an opening order (orderId === positionId) and, once
 * closed, a closing order of the opposite side. Fill price is `currentPrice`.
 * There is no profit field, so profit is computed from prices, volume and the
 * symbol's contract size (from /Home/getSymbolInfo), in the symbol's profit
 * currency, and converted to USD where that is exact without other rates.
 */
const { symbolInfo, crmAccounts, historyOrders, parseRange, ymd } = require('../utils/mt5Gateway');

const round = (n, dp = 2) => Math.round(n * 10 ** dp) / 10 ** dp;

/** Profit for one closed trade; currency is the symbol's profit currency. */
function computeProfit({ side, openPrice, closePrice, lots }, info) {
  if (!info?.contractSize) return { profit: null, profitCurrency: null, profitUsd: null };
  const sign = side === 'BUY' ? 1 : -1;
  const raw = (closePrice - openPrice) * sign * lots * Number(info.contractSize);
  const ccy = info.profitCurrency || null;
  let usd = null;
  if (ccy === 'USD') usd = raw;
  else if (info.baseCurrency === 'USD' && closePrice) usd = raw / closePrice; // e.g. USDJPY: JPY -> USD at close
  return {
    profit: round(raw, ccy === 'JPY' ? 0 : 2),
    profitCurrency: ccy,
    profitUsd: usd === null ? null : round(usd, 2),
  };
}

/** GET /api/mt5-accounts/history/trades?from=YYYY-MM-DD&to=YYYY-MM-DD&login=123&userId=6 */
const getTradeHistory = async (req, res) => {
  try {
    const range = parseRange(req.query);
    if (range.error) return res.status(400).json({ success: false, message: range.error });
    const { from, to } = range;

    const byLogin = await crmAccounts(req.query.login, req.query.userId);
    const logins = [...byLogin.keys()].map(Number).filter(Number.isFinite);
    if (!logins.length) return res.json({ success: true, data: [], openPositionIds: [], range: { from: ymd(from), to: ymd(to) } });

    const orders = await historyOrders(logins, from, to);

    // Group orders by position: opening order has orderId === positionId
    const byPosition = new Map();
    for (const o of orders) {
      const key = String(o.positionId);
      if (!byPosition.has(key)) byPosition.set(key, []);
      byPosition.get(key).push(o);
    }

    const symbols = new Set();
    const pairs = [];
    const stillOpen = [];
    for (const [positionId, list] of byPosition) {
      list.sort((a, b) => new Date(a.openTime) - new Date(b.openTime));
      const opening = list.find((o) => String(o.orderId) === positionId) || list[0];
      const closings = list.filter((o) => o !== opening && o.type !== opening.type);
      if (!closings.length) { stillOpen.push(positionId); continue; } // open position or opened before range
      symbols.add(opening.symbol);
      pairs.push({ positionId, opening, closings });
    }

    const infos = new Map();
    await Promise.all([...symbols].map(async (s) => infos.set(s, await symbolInfo(s))));

    const trades = pairs.map(({ positionId, opening, closings }) => {
      const closedLots = closings.reduce((s, c) => s + (Number(c.initialVolume) || 0), 0);
      // volume-weighted close price (partial closes)
      const closePrice = closedLots
        ? closings.reduce((s, c) => s + Number(c.currentPrice) * (Number(c.initialVolume) || 0), 0) / closedLots
        : Number(closings[closings.length - 1].currentPrice);
      const last = closings[closings.length - 1];
      const info = infos.get(opening.symbol);
      const side = opening.type === 'SELL' ? 'SELL' : 'BUY';
      const openPrice = Number(opening.currentPrice);
      const acc = byLogin.get(String(opening.loginId));
      const digits = Number(info?.digits) || 5;
      const lots = closedLots || Number(opening.initialVolume) || 0;

      return {
        positionId,
        login: String(opening.loginId),
        client: acc?.user?.name || acc?.contactName || null,
        userId: acc?.userId || null,
        group: acc?.groupName || null,
        symbol: opening.symbol,
        side,
        lots: round(lots, 2),
        openPrice: round(openPrice, digits),
        closePrice: round(closePrice, digits),
        openTime: opening.openTime,
        closeTime: last.closeTime || last.openTime,
        stopLoss: Number(opening.sl) || null,
        takeProfit: Number(opening.tp) || null,
        partialClose: closings.length > 1,
        ...computeProfit({ side, openPrice, closePrice, lots }, info),
      };
    }).sort((a, b) => new Date(b.closeTime) - new Date(a.closeTime));

    return res.json({ success: true, data: trades, openPositionIds: stillOpen, range: { from: ymd(from), to: ymd(to) } });
  } catch (err) {
    console.error('[TradeHistory] Failed:', err.response?.data || err.message);
    const gw = err.gatewayRetcode || err.response?.data?.retcode;
    return res.status(502).json({ success: false, message: gw ? `MT5 gateway: ${gw}` : 'Failed to load trade history from MT5.' });
  }
};

module.exports = { getTradeHistory };
