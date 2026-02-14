const { Router } = require('express');
const templateController = require('../controllers/template.controller');

const router = Router();

router.get('/', templateController.listTemplates);

router.get('/:slug', templateController.getTemplate);

module.exports = router;
