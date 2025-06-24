const jwt = require('../config/jwt');
const User = require('../models/usermodel');

module.exports = async (req, res, next) => {
  try {
    const token = req.cookies.token || req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Unauthorized' });
    const decoded = jwt.verify(token);
    req.user = await User.findById(decoded.id);
    next();
  } catch {
    res.status(401).json({ message: 'Invalid token' });
  }
};
