exports.sendErrorResponse = (
  res,
  statusCode = 400,
  message = 'An error occurred',
  data = null
) => {
  return res.status(statusCode).json({
    status: false,
    statusCode,
    message,
    data,
  });
};

exports.sendSuccessResponse = (
  res,
  statusCode = 200,
  message = 'Success',
  data = null
) => {
  return res.status(statusCode).json({
    status: true,
    statusCode,
    message,
    data,
  });
};

// Specific error response functions for common cases
exports.sendBadRequest = (res, message = 'Bad request') =>
  sendErrorResponse(res, 400, message);

exports.sendUnauthorized = (res, message = 'Unauthorized') =>
  sendErrorResponse(res, 401, message);

exports.sendForbidden = (res, message = 'Forbidden') =>
  sendErrorResponse(res, 403, message);

exports.sendNotFound = (res, message = 'Resource not found') =>
  sendErrorResponse(res, 404, message);

exports.sendConflict = (res, message = 'Conflict') =>
  sendErrorResponse(res, 409, message);

exports.sendServerError = (res, message = 'Internal server error') =>
  sendErrorResponse(res, 500, message);
