const { Queue } = require('bullmq');
const { createRedisClient } = require('../config/redis');

let automationQueue = null;

function getQueue() {
  if (!automationQueue) {
    const connection = createRedisClient();
    automationQueue = new Queue('automation-jobs', {
      connection,
      defaultJobOptions: {
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 5000 },
      },
    });
  }
  return automationQueue;
}

async function addJob(jobData) {
  const queue = getQueue();
  const bullJob = await queue.add('automation', jobData, {
    priority: jobData.priority || 5,
    attempts: jobData.maxRetries || 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
  });
  return bullJob;
}

async function cancelJob(jobId) {
  const queue = getQueue();
  const job = await queue.getJob(jobId);
  if (job) {
    const state = await job.getState();
    if (state === 'waiting' || state === 'delayed') {
      await job.remove();
      return true;
    }
  }
  return false;
}

async function getQueueStats() {
  const queue = getQueue();
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
    queue.getDelayedCount(),
  ]);
  return { waiting, active, completed, failed, delayed };
}

module.exports = { getQueue, addJob, cancelJob, getQueueStats };
