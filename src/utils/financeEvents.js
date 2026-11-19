const { getIo } = require('../config/socket');

/**
 * Tell the owning client (and admins) that a deposit/withdrawal was created or
 * changed status, so dashboards refresh without a page reload.
 * Never throws: a socket problem must not fail the money operation.
 *
 * @param {'deposit'|'withdrawal'} kind
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
}

module.exports = { emitFinanceUpdate };
