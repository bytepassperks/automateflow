const jwt = require('jsonwebtoken');
const { User, ApiKey } = require('../models');

async function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Authorization header required' });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Token required' });
  }

  if (token.startsWith('af_live_') || token.startsWith('af_test_')) {
    return authenticateApiKey(token, req, res, next);
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findByPk(decoded.userId);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
}

async function authenticateApiKey(key, req, res, next) {
  try {
    const keyHash = ApiKey.hashKey(key);
    const apiKey = await ApiKey.findOne({
      where: { keyHash, isActive: true },
      include: [{ model: User, as: 'user' }],
    });

    if (!apiKey) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    if (apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date()) {
      return res.status(401).json({ error: 'API key expired' });
    }

    apiKey.lastUsedAt = new Date();
    await apiKey.save();

    req.user = apiKey.user;
    req.apiKey = apiKey;
    next();
  } catch (err) {
    return res.status(500).json({ error: 'Authentication failed' });
  }
}

function authenticateWorker(req, res, next) {
  const secret = req.headers['x-worker-secret'];
  if (!secret || secret !== process.env.WORKER_SECRET) {
    return res.status(401).json({ error: 'Invalid worker secret' });
  }
  next();
}

module.exports = { authenticateToken, authenticateWorker };
