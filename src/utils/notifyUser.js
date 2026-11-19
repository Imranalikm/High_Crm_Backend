const { AppNotification } = require('../models');
const { getIo } = require('../config/socket');

/**
 * Store an in-app notification for one user and push it live to their
 * sockets ("new_notification" on room user_<id>).
 * Never throws: a notification problem must not fail the business action.
 *
 * @param {number} userId
 * @param {{ title: string, message: string, type?: string }} n
 *   type: deposit | withdrawal | balance | kyc | account | system
 */
async function notifyUser(userId, { title, message, type = 'system' }) {
  if (!userId) return null;
  try {
    const record = await AppNotification.create({ userId, title, message, type, isRead: false });
    try {
      getIo().to(`user_${userId}`).emit('new_notification', record.toJSON());
    } catch { /* socket not ready */ }
    return record;
  } catch (err) {
    console.warn('[notifyUser] failed:', err.message);
    return null;
  }
}

const money = (n) => `$${Math.abs(Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Client notification text for a deposit/withdrawal/balance-operation change, or null to skip. */
function financeNotification(kind, r) {
  const acc = r.accountId ? ` (MT5 #${r.accountId})` : '';
  const reason = r.comment ? ` Reason: ${r.comment}` : '';
  if (kind === 'deposit') {
    if (r.status === 'pending') return { type: 'deposit', title: 'Deposit request received', message: `Your deposit of ${money(r.amount)}${acc} is being reviewed.` };
    if (r.status === 'approved') return { type: 'deposit', title: 'Deposit approved', message: `${money(r.amount)} has been credited to your account${acc}.` };
    if (r.status === 'rejected') return { type: 'deposit', title: 'Deposit rejected', message: `Your deposit of ${money(r.amount)}${acc} was rejected.${reason}` };
    return null; // flagged etc. are internal
  }
  if (kind === 'withdrawal') {
    if (r.status === 'pending') return { type: 'withdrawal', title: 'Withdrawal request received', message: `Your withdrawal of ${money(r.amount)}${acc} is being reviewed.` };
    if (r.status === 'approved') return { type: 'withdrawal', title: 'Withdrawal approved', message: `${money(r.amount)} has been withdrawn from your account${acc}.` };
    if (r.status === 'rejected') return { type: 'withdrawal', title: 'Withdrawal rejected', message: `Your withdrawal of ${money(r.amount)}${acc} was rejected.${reason}` };
    return null;
  }
  if (kind === 'balance_operation' && r.status === 'completed') {
    const label = r.typeLabel || 'Balance operation';
    return {
      type: 'balance',
      title: label,
      message: `${label} of ${money(r.amount)} on your account${acc}.${r.comment && r.comment !== label ? ` ${r.comment}` : ''}`,
    };
  }
  return null;
}

module.exports = { notifyUser, financeNotification };
