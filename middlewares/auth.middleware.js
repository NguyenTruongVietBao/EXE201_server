const User = require('../models/User');
const { verifyToken } = require('../utils/auth');

const protectRoute = async (req, res, next) => {
  try {
    const accessToken = req.header('Authorization')?.split(' ')[1];
    if (!accessToken) {
      return res
        .status(401)
        .json({ message: 'No token, authorization denied' });
    }

    const decoded = verifyToken(accessToken);
    if (!decoded) {
      return res.status(401).json({ message: 'Token is not valid' });
    }

    const user = await User.findById(decoded.userId).select('-password');
    if (!user) {
      return res.status(404).send('User not found');
    }
    req.user = user;
    next();
  } catch (error) {
    console.log('ERROR protectRoute:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const authorizeRole = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'No permission' });
    }
    next();
  };
};

module.exports = { protectRoute, authorizeRole };
