const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'highcrm_access_token_secret_9823749823';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'highcrm_refresh_token_secret_12398712398';
const JWT_EXPIRE = process.env.JWT_EXPIRE || '15m';
const JWT_REFRESH_EXPIRE = process.env.JWT_REFRESH_EXPIRE || '7d';

/**
 * Generate Access Token containing user ID, username, and role
 */
function generateAccessToken(user) {
  const payload = {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role ? { id: user.role.id, key: user.role.key, name: user.role.name } : null
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRE });
}

/**
 * Generate Refresh Token
 */
function generateRefreshToken(user) {
  const payload = { id: user.id };
  return jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: JWT_REFRESH_EXPIRE });
}

/**
 * Verify Access Token
 */
function verifyAccessToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

/**
 * Verify Refresh Token
 */
function verifyRefreshToken(token) {
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET);
  } catch (error) {
    return null;
  }
}

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken
};
