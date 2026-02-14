const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');

const sesClient = new SESClient({
  region: process.env.AWS_SES_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_SES_ACCESS_KEY,
    secretAccessKey: process.env.AWS_SES_SECRET_KEY,
  },
});

const FROM_EMAIL = process.env.SES_FROM_EMAIL || 'noreply@automateflow.dev';

async function sendEmail(to, subject, htmlBody) {
  try {
    const command = new SendEmailCommand({
      Destination: {
        ToAddresses: [to],
      },
      Message: {
        Body: {
          Html: { Data: htmlBody },
        },
        Subject: { Data: subject },
      },
      Source: FROM_EMAIL,
    });

    await sesClient.send(command);
    return true;
  } catch (err) {
    console.error('Email send failed:', err.message);
    return false;
  }
}

async function sendJobCompleteEmail(user, job) {
  const subject = `AutomateFlow: Job "${job.name}" completed`;
  const html = `
    <h2>Job Completed</h2>
    <p>Hi ${user.name},</p>
    <p>Your automation job <strong>${job.name}</strong> has completed successfully.</p>
    <p>Execution time: ${job.executionTime ? `${(job.executionTime / 1000).toFixed(1)}s` : 'N/A'}</p>
    <p>View the results in your <a href="${process.env.FRONTEND_URL}/jobs/${job.id}">dashboard</a>.</p>
  `;
  return sendEmail(user.email, subject, html);
}

async function sendJobFailedEmail(user, job) {
  const subject = `AutomateFlow: Job "${job.name}" failed`;
  const html = `
    <h2>Job Failed</h2>
    <p>Hi ${user.name},</p>
    <p>Your automation job <strong>${job.name}</strong> has failed.</p>
    <p>Error: ${job.error || 'Unknown error'}</p>
    <p>View the details in your <a href="${process.env.FRONTEND_URL}/jobs/${job.id}">dashboard</a>.</p>
  `;
  return sendEmail(user.email, subject, html);
}

module.exports = { sendEmail, sendJobCompleteEmail, sendJobFailedEmail };
