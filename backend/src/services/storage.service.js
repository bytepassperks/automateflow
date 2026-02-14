const { PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { s3Client, BUCKET_NAME } = require('../config/storage');
const { v4: uuidv4 } = require('uuid');

async function uploadFile(buffer, originalName, contentType, folder = 'uploads') {
  const ext = originalName.split('.').pop();
  const key = `${folder}/${uuidv4()}.${ext}`;

  await s3Client.send(new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    ACL: 'public-read',
  }));

  const url = `${process.env.IDRIVE_E2_ENDPOINT}/${BUCKET_NAME}/${key}`;
  return { key, url };
}

async function getSignedDownloadUrl(key, expiresIn = 3600) {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });
  return getSignedUrl(s3Client, command, { expiresIn });
}

async function deleteFile(key) {
  await s3Client.send(new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  }));
}

module.exports = { uploadFile, getSignedDownloadUrl, deleteFile };
