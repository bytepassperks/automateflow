const { ApiKey } = require('../models');

async function createApiKey(req, res) {
  try {
    const { name, type = 'live' } = req.body;

    const activeCount = await ApiKey.count({
      where: { userId: req.user.id, isActive: true },
    });

    if (activeCount >= 10) {
      return res.status(400).json({ error: 'Maximum 10 active API keys allowed' });
    }

    const rawKey = ApiKey.generateKey(type);
    const keyHash = ApiKey.hashKey(rawKey);
    const keyPrefix = rawKey.substring(0, 12);

    const apiKey = await ApiKey.create({
      userId: req.user.id,
      name,
      keyHash,
      keyPrefix,
    });

    res.status(201).json({
      apiKey: {
        id: apiKey.id,
        name: apiKey.name,
        keyPrefix: apiKey.keyPrefix,
        key: rawKey,
        createdAt: apiKey.createdAt,
      },
      message: 'Save this key — it will not be shown again.',
    });
  } catch (err) {
    console.error('Create API key error:', err);
    res.status(500).json({ error: 'Failed to create API key' });
  }
}

async function listApiKeys(req, res) {
  try {
    const keys = await ApiKey.findAll({
      where: { userId: req.user.id },
      attributes: ['id', 'name', 'keyPrefix', 'lastUsedAt', 'isActive', 'expiresAt', 'createdAt'],
      order: [['createdAt', 'DESC']],
    });

    res.json({ apiKeys: keys });
  } catch (err) {
    console.error('List API keys error:', err);
    res.status(500).json({ error: 'Failed to list API keys' });
  }
}

async function revokeApiKey(req, res) {
  try {
    const key = await ApiKey.findOne({
      where: { id: req.params.id, userId: req.user.id },
    });

    if (!key) {
      return res.status(404).json({ error: 'API key not found' });
    }

    key.isActive = false;
    await key.save();

    res.json({ message: 'API key revoked' });
  } catch (err) {
    console.error('Revoke API key error:', err);
    res.status(500).json({ error: 'Failed to revoke API key' });
  }
}

module.exports = { createApiKey, listApiKeys, revokeApiKey };
