const mongoose = require('mongoose');

/**
 * Execute operations inside a MongoDB multi-document transaction when supported (replica sets, Atlas, production).
 * Gracefully falls back to direct execution when running against standalone MongoDB instances (e.g. local test instances).
 */
const runTransaction = async (action) => {
  const session = await mongoose.startSession();
  try {
    let result;
    try {
      await session.withTransaction(async () => {
        result = await action(session);
      });
      return result;
    } catch (err) {
      const isStandalone =
        err.code === 20 ||
        err.message?.includes('replica set') ||
        err.message?.includes('retryable writes') ||
        err.errorResponse?.errmsg?.includes('replica set') ||
        err.errorResponse?.errmsg?.includes('retryable writes');

      if (isStandalone) {
        return await action(null);
      }
      throw err;
    }
  } finally {
    await session.endSession();
  }
};

module.exports = { runTransaction };
