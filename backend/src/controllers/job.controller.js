const { Job, Template } = require('../models');
const { addJob, cancelJob: cancelBullJob } = require('../services/queue.service');
const { Op } = require('sequelize');

async function createJob(req, res) {
  try {
    const { name, templateId, taskDescription, parameters, webhookUrl, priority } = req.body;

    let template = null;
    if (templateId) {
      template = await Template.findByPk(templateId);
      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
      }
    }

    const job = await Job.create({
      userId: req.user.id,
      templateId: templateId || null,
      name,
      taskDescription,
      parameters: parameters || {},
      webhookUrl: webhookUrl || null,
      priority: priority || 5,
    });

    await addJob({
      jobId: job.id,
      userId: req.user.id,
      templateId: templateId || null,
      templateSlug: template ? template.slug : null,
      name,
      taskDescription,
      parameters: parameters || {},
      priority: priority || 5,
      maxRetries: job.maxRetries,
    });

    if (template) {
      await template.increment('usageCount');
    }

    res.status(201).json({ job });
  } catch (err) {
    console.error('Create job error:', err);
    res.status(500).json({ error: 'Failed to create job' });
  }
}

async function listJobs(req, res) {
  try {
    const { page = 1, limit = 20, status, from, to } = req.query;
    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const where = { userId: req.user.id };
    if (status) {
      where.status = status;
    }
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt[Op.gte] = new Date(from);
      if (to) where.createdAt[Op.lte] = new Date(to);
    }

    const { count, rows } = await Job.findAndCountAll({
      where,
      include: [{ model: Template, as: 'template', attributes: ['id', 'name', 'slug'] }],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit, 10),
      offset,
    });

    res.json({
      jobs: rows,
      pagination: {
        total: count,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        totalPages: Math.ceil(count / parseInt(limit, 10)),
      },
    });
  } catch (err) {
    console.error('List jobs error:', err);
    res.status(500).json({ error: 'Failed to list jobs' });
  }
}

async function getJob(req, res) {
  try {
    const job = await Job.findOne({
      where: { id: req.params.id, userId: req.user.id },
      include: [{ model: Template, as: 'template' }],
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.json({ job });
  } catch (err) {
    console.error('Get job error:', err);
    res.status(500).json({ error: 'Failed to get job' });
  }
}

async function cancelJobController(req, res) {
  try {
    const job = await Job.findOne({
      where: { id: req.params.id, userId: req.user.id },
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.status === 'completed' || job.status === 'failed' || job.status === 'canceled') {
      return res.status(400).json({ error: `Cannot cancel job with status: ${job.status}` });
    }

    await cancelBullJob(job.id);
    job.status = 'canceled';
    job.completedAt = new Date();
    await job.save();

    res.json({ job });
  } catch (err) {
    console.error('Cancel job error:', err);
    res.status(500).json({ error: 'Failed to cancel job' });
  }
}

async function handoffComplete(req, res) {
  try {
    const job = await Job.findOne({
      where: { id: req.params.id, userId: req.user.id },
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const io = req.app.get('io');
    if (io) {
      io.to(`job:${job.id}`).emit('handoff_resolved', { jobId: job.id });
    }

    res.json({ message: 'Handoff completion signal sent' });
  } catch (err) {
    console.error('Handoff complete error:', err);
    res.status(500).json({ error: 'Failed to signal handoff completion' });
  }
}

module.exports = { createJob, listJobs, getJob, cancelJob: cancelJobController, handoffComplete };
