const sequelize = require('../config/database');

const User = require('./User')(sequelize);
const Job = require('./Job')(sequelize);
const Template = require('./Template')(sequelize);
const ApiKey = require('./ApiKey')(sequelize);

User.hasMany(Job, { foreignKey: 'userId', as: 'jobs' });
Job.belongsTo(User, { foreignKey: 'userId', as: 'user' });

Template.hasMany(Job, { foreignKey: 'templateId', as: 'jobs' });
Job.belongsTo(Template, { foreignKey: 'templateId', as: 'template' });

User.hasMany(ApiKey, { foreignKey: 'userId', as: 'apiKeys' });
ApiKey.belongsTo(User, { foreignKey: 'userId', as: 'user' });

module.exports = {
  sequelize,
  User,
  Job,
  Template,
  ApiKey,
};
