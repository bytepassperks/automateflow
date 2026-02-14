const { Router } = require('express');
const { body, query } = require('express-validator');
const { validate } = require('../middleware/validation.middleware');
const { authenticateToken } = require('../middleware/auth.middleware');
const jobController = require('../controllers/job.controller');

const router = Router();

router.use(authenticateToken);

router.post('/', [
  body('name').notEmpty().trim().withMessage('Job name is required'),
  body('taskDescription').optional().isString(),
  body('templateId').optional().isUUID(),
  body('parameters').optional().isObject(),
  body('webhookUrl').optional().isURL(),
  body('priority').optional().isInt({ min: 1, max: 10 }),
  validate,
], jobController.createJob);

router.get('/', [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('status').optional().isIn(['queued', 'processing', 'completed', 'failed', 'canceled']),
  validate,
], jobController.listJobs);

router.get('/:id', jobController.getJob);

router.post('/:id/cancel', jobController.cancelJob);

router.post('/:id/handoff-complete', jobController.handoffComplete);

module.exports = router;
