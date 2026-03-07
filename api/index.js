// Vercel serverless entrypoint that reuses the existing Express app.
// This keeps all routing/middleware defined under backend/app.js while
// letting Vercel invoke it as an Edge Function-compatible handler.

const app = require('../backend/app');

module.exports = app;
