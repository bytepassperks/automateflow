const { Template } = require('../models');

async function listTemplates(req, res) {
  try {
    const { category } = req.query;
    const where = { isPublic: true };
    if (category) {
      where.category = category;
    }

    const templates = await Template.findAll({
      where,
      order: [['usageCount', 'DESC']],
    });

    res.json({ templates });
  } catch (err) {
    console.error('List templates error:', err);
    res.status(500).json({ error: 'Failed to list templates' });
  }
}

async function getTemplate(req, res) {
  try {
    const template = await Template.findOne({
      where: { slug: req.params.slug, isPublic: true },
    });

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json({ template });
  } catch (err) {
    console.error('Get template error:', err);
    res.status(500).json({ error: 'Failed to get template' });
  }
}

module.exports = { listTemplates, getTemplate };
