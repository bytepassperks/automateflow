const { Router } = require('express');
const { body } = require('express-validator');
const { validate } = require('../middleware/validation.middleware');
const { authenticateToken } = require('../middleware/auth.middleware');
const authController = require('../controllers/auth.controller');

const router = Router();

router.post('/register', [
  body('email').isEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('name').notEmpty().trim().withMessage('Name is required'),
  validate,
], authController.register);

router.post('/login', [
  body('email').isEmail().withMessage('Valid email required'),
  body('password').notEmpty().withMessage('Password is required'),
  validate,
], authController.login);

router.post('/refresh', [
  body('refreshToken').notEmpty().withMessage('Refresh token required'),
  validate,
], authController.refresh);

router.get('/me', authenticateToken, authController.me);

module.exports = router;
