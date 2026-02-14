const { Job, User } = require('../models');
const { sendJobCompleteEmail, sendJobFailedEmail } = require('../services/email.service');

async function workerCallback(req, res) {
  try {
    const { jobId, status, result, error, logs, screenshots, executionTime, handoff } = req.body;

    const job = await Job.findByPk(jobId, {
      include: [{ model: User, as: 'user' }],
    });

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (status) job.status = status;
    if (result !== undefined) job.result = result;
    if (error !== undefined) job.error = error;
    if (executionTime !== undefined) job.executionTime = executionTime;

    if (logs && Array.isArray(logs)) {
      const currentLogs = job.logs || [];
      job.logs = [...currentLogs, ...logs];
    }

    if (screenshots && Array.isArray(screenshots)) {
      const currentScreenshots = job.screenshots || [];
      job.screenshots = [...currentScreenshots, ...screenshots];
    }

    if (status === 'processing' && !job.startedAt) {
      job.startedAt = new Date();
    }

    if (status === 'completed' || status === 'failed') {
      job.completedAt = new Date();
    }

    await job.save();

    const io = req.app.get('io');
    if (io) {
      io.to(`user:${job.userId}`).emit('job_updated', {
        jobId: job.id,
        status: job.status,
        logs: logs || [],
        screenshots: screenshots || [],
        result: job.result,
        error: job.error,
        executionTime: job.executionTime,
      });

      if (handoff) {
        io.to(`user:${job.userId}`).emit('handoff_requested', {
          jobId: job.id,
          reason: handoff.reason,
        });
      }
    }

    if (status === 'completed' && job.user && job.user.notificationPreferences?.emailOnComplete) {
      sendJobCompleteEmail(job.user, job).catch((err) => {
        console.error('Failed to send completion email:', err);
      });
    }

    if (status === 'failed' && job.user && job.user.notificationPreferences?.emailOnFailure) {
      sendJobFailedEmail(job.user, job).catch((err) => {
        console.error('Failed to send failure email:', err);
      });
    }

    if ((status === 'completed' || status === 'failed') && job.webhookUrl) {
      sendWebhook(job).catch((err) => {
        console.error('Webhook delivery failed:', err);
      });
    }

    res.json({ message: 'Job updated' });
  } catch (err) {
    console.error('Worker callback error:', err);
    res.status(500).json({ error: 'Failed to process callback' });
  }
}

async function sendWebhook(job) {
  const payload = JSON.stringify({
    event: job.status === 'completed' ? 'job.completed' : 'job.failed',
    jobId: job.id,
    status: job.status,
    result: job.result,
    error: job.error,
    executionTime: job.executionTime,
    completedAt: job.completedAt,
  });

  const url = new URL(job.webhookUrl);
  const options = {
    hostname: url.hostname,
    port: url.port || (url.protocol === 'https:' ? 443 : 80),
    path: url.pathname + url.search,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload),
      'X-AutomateFlow-Event': job.status === 'completed' ? 'job.completed' : 'job.failed',
    },
  };

  const httpModule = url.protocol === 'https:' ? require('node:https') : require('node:http');

  return new Promise((resolve, reject) => {
    const req = httpModule.request(options, (res) => {
      resolve(res.statusCode);
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

module.exports = { workerCallback };
