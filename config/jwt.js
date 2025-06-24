const jwt = require('jsonwebtoken');
const JWT_SECRET     = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN = '24h';

module.exports = {
  sign: (payload) => jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN }),
  verify: (token) => jwt.verify(token, JWT_SECRET)
};
