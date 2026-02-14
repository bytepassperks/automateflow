const { DataTypes } = require('sequelize');
const crypto = require('crypto');

module.exports = (sequelize) => {
  const ApiKey = sequelize.define('ApiKey', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },
    keyHash: {
      type: DataTypes.STRING(64),
      allowNull: false,
      unique: true,
    },
    keyPrefix: {
      type: DataTypes.STRING(12),
      allowNull: false,
    },
    lastUsedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  }, {
    tableName: 'api_keys',
    timestamps: true,
  });

  ApiKey.generateKey = function (type = 'live') {
    const prefix = type === 'live' ? 'af_live_' : 'af_test_';
    const randomPart = crypto.randomBytes(24).toString('hex');
    return prefix + randomPart;
  };

  ApiKey.hashKey = function (key) {
    return crypto.createHash('sha256').update(key).digest('hex');
  };

  return ApiKey;
};
