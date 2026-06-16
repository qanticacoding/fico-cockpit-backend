/**
 * Error Handler - Gestione centralizzata errori
 */

import logger from './logger.js';

/**
 * Classe base per errori custom
 */
class AppError extends Error {
  constructor(message, statusCode = 500, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.timestamp = new Date().toISOString();
    
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Errore estrattore
 */
class ExtractorError extends AppError {
  constructor(extractorName, message, originalError = null) {
    super(`Extractor ${extractorName}: ${message}`, 500);
    this.extractorName = extractorName;
    this.originalError = originalError;
  }
}

/**
 * Errore database
 */
class DatabaseError extends AppError {
  constructor(operation, message, originalError = null) {
    super(`Database ${operation}: ${message}`, 500);
    this.operation = operation;
    this.originalError = originalError;
  }
}

/**
 * Errore validazione
 */
class ValidationError extends AppError {
  constructor(field, message) {
    super(`Validation error on ${field}: ${message}`, 400);
    this.field = field;
  }
}

/**
 * Handler errore generico
 */
function handleError(error, context = '') {
  const errorInfo = {
    message: error.message,
    stack: error.stack,
    context,
    timestamp: new Date().toISOString()
  };

  if (error instanceof AppError) {
    logger.error(`Application Error [${context}]:`, errorInfo);
  } else {
    logger.error(`Unexpected Error [${context}]:`, errorInfo);
  }

  return {
    success: false,
    error: error.message,
    context,
    timestamp: errorInfo.timestamp
  };
}

/**
 * Wrapper per funzioni async con gestione errori
 */
function asyncHandler(fn, context = '') {
  return async function(...args) {
    try {
      return await fn(...args);
    } catch (error) {
      return handleError(error, context);
    }
  };
}

/**
 * Retry logic con backoff esponenziale
 */
async function retryWithBackoff(fn, maxAttempts = 3, baseDelay = 1000) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt < maxAttempts) {
        const delay = baseDelay * Math.pow(2, attempt - 1);
        logger.warn(`Attempt ${attempt} failed, retrying in ${delay}ms...`, { error: error.message });
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
}

export {
  AppError,
  ExtractorError,
  DatabaseError,
  ValidationError,
  handleError,
  asyncHandler,
  retryWithBackoff
};
