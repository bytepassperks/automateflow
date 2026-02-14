require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const path = require('path');
const { createServer } = require('http');
const { Server } = require('socket.io');
const { sequelize } = require('./models');
const { seedTemplates } = require('./seed');

const authRoutes = require('./routes/auth.routes');
const jobRoutes = require('./routes/job.routes');
const templateRoutes = require('./routes/template.routes');
const apikeyRoutes = require('./routes/apikey.routes');
const webhookRoutes = require('./routes/webhook.routes');

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

app.set('io', io);

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));
app.use(compression());
app.use(cors({
  origin: '*',
  credentials: true,
}));
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/keys', apikeyRoutes);
app.use('/api/webhooks', webhookRoutes);

app.get('/api/screenshots/:key(*)', async (req, res) => {
  try {
    const { GetObjectCommand } = require('@aws-sdk/client-s3');
    const { s3Client, BUCKET_NAME } = require('./config/storage');
    const key = req.params.key;
    const command = new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key });
    const response = await s3Client.send(command);
    res.set('Content-Type', response.ContentType || 'image/png');
    res.set('Cache-Control', 'public, max-age=86400');
    response.Body.pipe(res);
  } catch (err) {
    console.error('Screenshot proxy error:', err.message);
    res.status(404).json({ error: 'Screenshot not found' });
  }
});

const frontendPath = path.join(__dirname, '../frontend-dist');
app.use(express.static(frontendPath));

app.get(/^(?!\/api|\/health|\/socket\.io).*/, (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

app.use((err, req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id);

  socket.on('join_user', (userId) => {
    socket.join(`user:${userId}`);
  });

  socket.on('join_job', (jobId) => {
    socket.join(`job:${jobId}`);
  });

  socket.on('leave_job', (jobId) => {
    socket.leave(`job:${jobId}`);
  });

  socket.on('disconnect', () => {
    console.log('Socket disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;

async function start() {
  try {
    await sequelize.authenticate();
    console.log('Database connection established');

    await sequelize.sync({ alter: true });
    console.log('Database synced');

    await seedTemplates();

    httpServer.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
