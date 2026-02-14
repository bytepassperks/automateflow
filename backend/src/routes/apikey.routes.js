const { Router } = require('express');
const { body } = require('express-validator');
const { validate } = require('../middleware/validation.middleware');
const { authenticateToken } = require('../middleware/auth.middleware');
const apikeyController = require('../controllers/apikey.controller');

const router = Router();

router.use(authenticateToken);

router.post('/', [
  body('name').notEmpty().trim().withMessage('Key name is required'),
  body('type').optional().isIn(['live', 'test']),
  validate,
], apikeyController.createApiKey);

router.get('/', apikeyController.listApiKeys);

router.delete('/:id', apikeyController.revokeApiKey);

module.exports = router;
