// filepath: /Users/oscar/Nizzia-City-Rewrite/backend/app.js
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const connectDB = require('./config/db');
const { mountRoutes } = require('./routes');
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');
const requestLogger = require('./middleware/requestLogger');
const { attachAuth } = require('./middleware/authUser');

const scheduleRegenEnergy = require('./cronjobs/regenEnergy');
const scheduleRegenNerve = require('./cronjobs/regenNerve');
const scheduleJob = require('./cronjobs/jobCron');
const scheduleRegenHappiness = require('./cronjobs/regenHappiness');
const scheduleStockTicker = require('./cronjobs/stockTicker');
const scheduleRegenCooldowns = require('./cronjobs/regenCooldowns');
const scheduleNpcActions = require('./cronjobs/npcActions');
const schedulePlayerSnapshots = require('./cronjobs/playerSnapshot');
const scheduleBankApr = require('./cronjobs/bankApr');
const scheduleDailyReset = require('./cronjobs/dailyReset');
const scheduleBusinessIncome = require('./cronjobs/businessCron');
const scheduleCartelTick = require('./cronjobs/cartelCron');

const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

const extraOrigins = (process.env.CORS_ALLOWLIST || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const restrictCors = extraOrigins.length > 0;
const allowedOrigins = new Set([...DEFAULT_ALLOWED_ORIGINS, ...extraOrigins]);

const app = express();

// Connect to MongoDB once per runtime
connectDB();

const corsOptions = {
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (!restrictCors || allowedOrigins.has(origin)) {
      return callback(null, true);
    }
    return callback(null, false);
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));
app.use(express.json());
app.use(attachAuth); // ← set req.authUserId on every request
app.use(requestLogger());

// Routes
mountRoutes(app);

// Serve built SPA when available (Docker/Railway deployments)
const distDir = path.join(__dirname, '../frontend-vue/dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));

  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

// 404 and error handlers
app.use(notFound);
app.use(errorHandler);

// Start cron jobs unless disabled or running in a serverless environment
const runningOnVercel = Boolean(process.env.VERCEL);
const cronDisabled = process.env.DISABLE_CRON === 'true' || runningOnVercel;

if (!cronDisabled) {
  scheduleRegenEnergy();
  scheduleRegenNerve();
  scheduleJob();
  scheduleRegenHappiness();
  scheduleStockTicker();
  scheduleBankApr();
  scheduleNpcActions();
  schedulePlayerSnapshots();
  scheduleRegenCooldowns();
  scheduleDailyReset();
  scheduleBusinessIncome();
  scheduleCartelTick();
} else if (process.env.NODE_ENV !== 'test') {
  console.log('Cron jobs disabled for this runtime.');
}

module.exports = app;
