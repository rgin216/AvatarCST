const errorHandler = (err, req, res, next) => {
  const status = err.status || 500;
  const safeMessage = process.env.NODE_ENV === 'development'
    ? err.message
    : 'Request failed';
  console.error(`[${status}] ${req.method} ${req.path} — ${safeMessage}`);
  res.status(status).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

export default errorHandler;
