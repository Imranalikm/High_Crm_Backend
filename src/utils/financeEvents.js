const { getIo } = require('../config/socket');

/**
 * Tell the owning client (and admins) that a deposit/withdrawal/balance
 * operation was created or changed status, so dashboards refresh without a
 * page reload, and store an in-app notification for the client.
 * Never throws: a socket problem must not fail the money operation.
 *
 * @param {'deposit'|'withdrawal'|'balance_operation'} kind
 * @param {object} record Sequelize instance or plain object (needs id, createdFor, status)
 */
function emitFinanceUpdate(kind, record) {
  try {
    if (!record) return;
    const payload = {
      kind,
      id: record.id,
      status: record.status,
      amount: record.amount,
      accountId: record.accountId,
      createdFor: record.createdFor,
    };
    const io = getIo();
    if (record.createdFor) io.to(`user_${record.createdFor}`).emit('finance:updated', payload);
    io.to('admin_room').emit('finance:updated', payload);
  } catch (err) {
    console.warn('[financeEvents] emit failed:', err.message);
  }

  // Client notification (lazy require: avoids a load-order cycle with models)
  try {
    const { notifyUser, financeNotification } = require('./notifyUser');
    const plain = record?.toJSON ? record.toJSON() : record;
    const n = plain?.createdFor && financeNotification(kind, { ...plain, typeLabel: record.typeLabel || plain.typeLabel });
    if (n) notifyUser(plain.createdFor, n);
  } catch (err) {
    console.warn('[financeEvents] notification failed:', err.message);
  }
}

module.exports = { emitFinanceUpdate };
