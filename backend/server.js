const chalk = (() => {
  try {
    const mod = require('chalk');
    return mod && mod.default ? mod.default : mod;
  } catch (_) {
    const passthrough = (msg) => msg;
    return { green: passthrough, yellow: passthrough, red: passthrough, blue: passthrough };
  }
})();

const app = require('./app');

// When running locally (npm start / npm run dev) we start the HTTP server here.
if (!process.env.VERCEL) {
  const PORT = Number(process.env.PORT) || 5050;
  app.listen(PORT, () => {
    console.log(chalk.blue('Server started at ' + new Date().toISOString()));
    console.log(chalk.green(`Server is running on port ${PORT}`));
  });
}

// Export the Express instance so Vercel can wrap it in a serverless handler.
module.exports = app;
