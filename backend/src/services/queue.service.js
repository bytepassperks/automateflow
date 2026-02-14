const { Queue } = require('bullmq');

let automationQueue = null;

function parseRedisUrl(url) {
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: parseInt(parsed.port, 10) || 6379,
      password: parsed.password || undefined,
      username: parsed.username || undefined,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    };
  } catch (e) {
    console.error('Failed to parse REDIS_URL:', e.message);
    return { host: 'localhost', port: 6379, maxRetriesPerRequest: null, enableReadyCheck: false };
  }
}

function getQueue() {
  if (!automationQueue) {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    const connection = parseRedisUrl(redisUrl);
    console.log(`BullMQ connecting to Redis at ${connection.host}:${connection.port}`);
    automationQueue = new Queue('automation-jobs', {
      connection,
      defaultJobOptions: {
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 5000 },
      },
    });
    automationQueue.on('error', (err) => {
      console.error('BullMQ queue error:', err.message);
    });
  }
  return automationQueue;
}

async function addJob(jobData) {
  const queue = getQueue();
  console.log(`Queuing job ${jobData.jobId} to BullMQ...`);
  const bullJob = await queue.add('automation', jobData, {
    priority: jobData.priority || 5,
    attempts: jobData.maxRetries || 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
  });
  console.log(`Job ${jobData.jobId} queued as BullMQ job #${bullJob.id}`);
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
