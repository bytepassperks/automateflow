const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Template = sequelize.define('Template', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    slug: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    category: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    script: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    parameters: {
      type: DataTypes.JSONB,
      defaultValue: {},
    },
    requiredFields: {
      type: DataTypes.JSONB,
      defaultValue: [],
    },
    tags: {
      type: DataTypes.JSONB,
      defaultValue: [],
    },
    isPublic: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    usageCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    successRate: {
      type: DataTypes.FLOAT,
      defaultValue: 0,
    },
  }, {
    tableName: 'templates',
    timestamps: true,
  });

  return Template;
};
