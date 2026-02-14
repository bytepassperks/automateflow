const { Sequelize } = require('sequelize');

const dbUrl = (process.env.DATABASE_URL || '').replace(/[?&]sslmode=[^&]*/g, '');

const useSSL = process.env.DATABASE_URL && process.env.DATABASE_URL.includes('digitalocean');

const sequelize = new Sequelize(dbUrl, {
  dialect: 'postgres',
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
  pool: {
    max: 10,
    min: 2,
    acquire: 30000,
    idle: 10000,
  },
  dialectOptions: useSSL || process.env.NODE_ENV === 'production' ? {
    ssl: {
      require: true,
      rejectUnauthorized: false,
    },
  } : {},
});

module.exports = sequelize;
