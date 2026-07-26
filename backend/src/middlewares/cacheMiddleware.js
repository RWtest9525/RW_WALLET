// File: backend/src/middlewares/cacheMiddleware.js

function applyNoCacheHeaders(req, res, next) {
  if (req.method === 'GET' && (req.path === '/' || req.path.endsWith('.html'))) {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.set('Surrogate-Control', 'no-store');
  }
  next();
}

module.exports = {
  applyNoCacheHeaders
};
