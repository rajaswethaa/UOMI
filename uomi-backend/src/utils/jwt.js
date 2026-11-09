const jwt = require('jsonwebtoken');
const ApiError = require('./api-error');

const ISSUER = 'uomi-backend';

function signAccessToken(user) {
  return jwt.sign(
    { sub: String(user.id), role: user.role },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || '1d',
      issuer: ISSUER,
    }
  );
}

function verifyAccessToken(token) {
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, { issuer: ISSUER });
    return { id: payload.sub, role: payload.role };
  } catch (error) {
    throw ApiError.unauthorized('Invalid or expired token');
  }
}

module.exports = { signAccessToken, verifyAccessToken };
