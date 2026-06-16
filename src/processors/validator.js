/**
 * Validator - Validazione dati generica
 */

import logger from '../utils/logger.js';

/**
 * Valida parametri job
 */
function validateJobParams(params, requiredParams = []) {
  const missing = [];

  for (const param of requiredParams) {
    if (params[param] === undefined || params[param] === null) {
      missing.push(param);
    }
  }

  if (missing.length > 0) {
    throw new Error(`Parametri obbligatori mancanti: ${missing.join(', ')}`);
  }

  return true;
}

/**
 * Valida response SAP
 */
function validateSapResponse(data) {
  if (!data) {
    throw new Error('Response SAP vuota');
  }

  if (!Array.isArray(data)) {
    throw new Error('Response SAP non è un array');
  }

  if (data.length === 0) {
    logger.warn('Response SAP contiene 0 record');
  }

  return true;
}

/**
 * Valida configurazione job
 */
function validateJobConfig(jobConfig) {
  const required = ['id', 'schedule', 'extractors'];

  for (const field of required) {
    if (!jobConfig[field]) {
      throw new Error(`Configurazione job non valida: manca ${field}`);
    }
  }

  if (!Array.isArray(jobConfig.extractors) || jobConfig.extractors.length === 0) {
    throw new Error('Job deve avere almeno un estrattore');
  }

  return true;
}

export {
  validateJobParams,
  validateSapResponse,
  validateJobConfig
};
