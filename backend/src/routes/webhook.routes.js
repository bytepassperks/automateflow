const { Router } = require('express');
const { authenticateWorker } = require('../middleware/auth.middleware');
const webhookController = require('../controllers/webhook.controller');

const router = Router();

router.post('/worker', authenticateWorker, webhookController.workerCallback);

module.exports = router;
