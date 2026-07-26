const { startServer } = require('./src/server');

startServer().catch((error) => {
  console.error(error);
  process.exit(1);
});
