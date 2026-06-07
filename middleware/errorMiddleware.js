const errorHandler = (err, req, res, _next) => {
  const statusCode = res.statusCode ? (res.statusCode === 200 ? 500 : res.statusCode) : 500;
  
  res.status(statusCode).json({
    message: err.message,
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  });
};

module.exports = { errorHandler };
