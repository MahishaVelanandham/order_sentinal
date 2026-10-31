/**
 * HTTP Request Logger Middleware
 */
const requestLogger = (req, res, next) => {
  const start = Date.now();
  const { method, originalUrl } = req;

  res.on('finish', () => {
    const duration = Date.now() - start;
    const { statusCode } = res;
    console.log(`[HTTP] ${method} ${originalUrl} -> ${statusCode} (${duration}ms)`);
  });

  next();
};

module.exports = requestLogger;
