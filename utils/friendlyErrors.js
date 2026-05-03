/**
 * friendlyErrors.js
 * Translates raw technical errors into simple, human-readable messages
 * suitable for both parents and children.
 */

/**
 * Given any error, returns a simple message and HTTP status code.
 * @param {Error} error
 * @returns {{ status: number, message: string }}
 */
function friendlyError(error) {
  // ── MongoDB Duplicate Key (E11000) ──────────────────────────────────────
  if (error.code === 11000) {
    const field = Object.keys(error.keyPattern || {})[0] || '';
    if (field === 'email') {
      return {
        status: 409,
        message: "That email is already used by another account. Try logging in instead, or use a different email."
      };
    }
    if (field === 'handle') {
      return {
        status: 409,
        message: "That username is already taken. Please pick a different one."
      };
    }
    return {
      status: 409,
      message: "An account with those details already exists. Please try different information."
    };
  }

  // ── Mongoose Validation Errors ─────────────────────────────────────────
  if (error.name === 'ValidationError') {
    const messages = Object.values(error.errors).map(e => e.message);
    return {
      status: 400,
      message: messages[0] || "Some information you entered is invalid. Please check and try again."
    };
  }

  // ── Mongoose Cast Error (bad ObjectId) ─────────────────────────────────
  if (error.name === 'CastError') {
    return {
      status: 400,
      message: "We couldn't find what you were looking for. Please try again."
    };
  }

  // ── JWT Errors ─────────────────────────────────────────────────────────
  if (error.name === 'JsonWebTokenError') {
    return {
      status: 401,
      message: "Your session is invalid. Please log out and log in again."
    };
  }
  if (error.name === 'TokenExpiredError') {
    return {
      status: 401,
      message: "Your session has expired. Please log in again to continue."
    };
  }

  // ── Network / Timeout ──────────────────────────────────────────────────
  if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
    return {
      status: 503,
      message: "We're having trouble connecting right now. Please try again in a moment."
    };
  }

  // ── Default Fallback ───────────────────────────────────────────────────
  // Never expose raw error messages in production
  const isDev = process.env.NODE_ENV === 'development';
  return {
    status: 500,
    message: isDev
      ? error.message
      : "Something went wrong on our end. Please try again."
  };
}

module.exports = { friendlyError };
