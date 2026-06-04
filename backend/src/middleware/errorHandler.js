const errorHandler = (err, req, res, next) => {
  const status = err.status || 500;
  console.error(`[${status}] ${req.method} ${req.path} —`, err.message);
  res.status(status).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

export default errorHandler;
