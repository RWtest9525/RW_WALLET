// File: backend/src/config/env.js
require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,
  corsOrigin: process.env.CORS_ORIGIN || '*',
  commitSha: process.env.RENDER_GIT_COMMIT || process.env.COMMIT_SHA || 'local',
  nodeEnv: process.env.NODE_ENV || 'development'
};
