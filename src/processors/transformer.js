/**
 * Transformer - Trasformazione dati SAP per DuckDB
 */

import logger from '../utils/logger.js';

/**
 * Trasforma record SAP FI in formato normalizzato
 * Ogni hslXX diventa un record separato con fiscal_period
 */
function transformSapFiData(sapRecords, jobId, extractionDate) {
  if (!Array.isArray(sapRecords)) {
    logger.error('transformSapFiData: input non è un array');
    return [];
  }

  logger.info(`Trasformazione di ${sapRecords.length} record SAP...`);
  const normalized = [];

  sapRecords.forEach((record, index) => {
    try {
      // Campi base comuni
      const baseRecord = {
        fiscal_year: record.ryear,
        account: record.racct,
        account_desc: record.txt50 || null,
        cost_center: record.rcntr || null,
        cost_center_desc: record.ltext || null,
        extraction_date: extractionDate,
        job_id: jobId
      };

      // Mappa hslvt → period 0 (saldo anno precedente)
      if (record.hslvt !== undefined && record.hslvt !== null) {
        normalized.push({
          ...baseRecord,
          fiscal_period: 0,
          amount: parseFloat(record.hslvt)
        });
      }

      // Mappa hsl01-hsl12 → period 1-12
      for (let period = 1; period <= 12; period++) {
        const fieldName = `hsl${period.toString().padStart(2, '0')}`;
        const value = record[fieldName];

        if (value !== undefined && value !== null) {
          normalized.push({
            ...baseRecord,
            fiscal_period: period,
            amount: parseFloat(value)
          });
        }
      }
    } catch (error) {
      logger.error(`Errore trasformazione record ${index}:`, error);
    }
  });

  logger.info(`Trasformati ${normalized.length} record normalizzati da ${sapRecords.length} record SAP`);
  return normalized;
}

/**
 * Valida record normalizzato
 */
function validateNormalizedRecord(record) {
  const required = ['fiscal_year', 'account', 'fiscal_period', 'extraction_date', 'job_id'];
  
  for (const field of required) {
    if (record[field] === undefined || record[field] === null) {
      return { valid: false, error: `Campo obbligatorio mancante: ${field}` };
    }
  }

  // Valida fiscal_period: 0-12
  if (record.fiscal_period < 0 || record.fiscal_period > 12) {
    return { valid: false, error: `fiscal_period non valido: ${record.fiscal_period}` };
  }

  // Valida amount se presente
  if (record.amount !== null && record.amount !== undefined) {
    if (typeof record.amount !== 'number' || isNaN(record.amount)) {
      return { valid: false, error: `amount non valido: ${record.amount}` };
    }
  }

  return { valid: true };
}

/**
 * Filtra e valida batch di record
 */
function validateBatch(records) {
  const valid = [];
  const invalid = [];

  records.forEach((record, index) => {
    const validation = validateNormalizedRecord(record);
    if (validation.valid) {
      valid.push(record);
    } else {
      logger.warn(`Record ${index} non valido: ${validation.error}`, record);
      invalid.push({ record, error: validation.error });
    }
  });

  if (invalid.length > 0) {
    logger.warn(`${invalid.length} record non validi su ${records.length} totali`);
  }

  return { valid, invalid };
}

export {
  transformSapFiData,
  validateNormalizedRecord,
  validateBatch
};
