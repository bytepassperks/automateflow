const { S3Client } = require('@aws-sdk/client-s3');

const s3Client = new S3Client({
  endpoint: process.env.IDRIVE_E2_ENDPOINT,
  region: 'us-east-1',
  credentials: {
    accessKeyId: process.env.IDRIVE_E2_ACCESS_KEY,
    secretAccessKey: process.env.IDRIVE_E2_SECRET_KEY,
  },
  forcePathStyle: true,
});

const BUCKET_NAME = process.env.IDRIVE_E2_BUCKET || 'automateflow-files';

module.exports = { s3Client, BUCKET_NAME };
