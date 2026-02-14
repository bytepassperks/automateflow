const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Job = sequelize.define('Job', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    templateId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },
    status: {
      type: DataTypes.ENUM('queued', 'processing', 'completed', 'failed', 'canceled'),
      defaultValue: 'queued',
      allowNull: false,
    },
    taskDescription: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    parameters: {
      type: DataTypes.JSONB,
      defaultValue: {},
    },
    result: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    error: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    logs: {
      type: DataTypes.JSONB,
      defaultValue: [],
    },
    screenshots: {
      type: DataTypes.JSONB,
      defaultValue: [],
    },
    executionTime: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    startedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    completedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    priority: {
      type: DataTypes.INTEGER,
      defaultValue: 5,
      validate: {
        min: 1,
        max: 10,
      },
    },
    webhookUrl: {
      type: DataTypes.STRING(2048),
      allowNull: true,
      validate: {
        isUrl: true,
      },
    },
    retryCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    maxRetries: {
      type: DataTypes.INTEGER,
      defaultValue: 3,
    },
  }, {
    tableName: 'jobs',
    timestamps: true,
  });

  return Job;
};
