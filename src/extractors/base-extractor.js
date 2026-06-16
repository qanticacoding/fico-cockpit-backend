/**
 * Base Extractor - Classe base per tutti gli estrattori SAP
 */

import logger from '../utils/logger.js';
import { ExtractorError } from '../utils/error-handler.js';

class BaseExtractor {
  constructor(config = {}) {
    this.config = config;
    this.name = this.constructor.name;
  }

  /**
   * Metodo principale da implementare in ogni estrattore
   * @param {Object} params - Parametri estrattore
   * @returns {Promise<Array>} - Array di oggetti JSON da SAP
   */
  async extract(params) {
    throw new ExtractorError(
      this.name,
      'Il metodo extract() deve essere implementato'
    );
  }

  /**
   * Validazione parametri (override se necessario)
   * @param {Object} params
   * @returns {boolean}
   */
  validateParams(params) {
    logger.debug(`${this.name}: validazione parametri`, params);
    return true;
  }

  /**
   * Hook pre-estrazione (override se necessario)
   */
  async beforeExtract(params) {
    logger.debug(`${this.name}: beforeExtract`);
  }

  /**
   * Hook post-estrazione (override se necessario)
   */
  async afterExtract(data, params) {
    logger.debug(`${this.name}: afterExtract - ${data.length} record`);
    return data;
  }

  /**
   * Esegue l'estrazione con hooks
   */
  async run(params = {}) {
    try {
      logger.info(`=== ${this.name}: Avvio estrazione ===`);
      
      // Validazione
      this.validateParams(params);
      
      // Pre-processing
      await this.beforeExtract(params);
      
      // Estrazione
      const startTime = Date.now();
      let data = await this.extract(params);
      const duration = Date.now() - startTime;
      
      logger.info(`${this.name}: Estratti ${data.length} record in ${duration}ms`);
      
      // Post-processing
      data = await this.afterExtract(data, params);
      
      return {
        success: true,
        extractorName: this.name,
        recordCount: data.length,
        duration,
        data
      };
      
    } catch (error) {
      logger.error(`${this.name}: Errore durante estrazione`, error);
      throw new ExtractorError(this.name, error.message, error);
    }
  }

  /**
   * Helper per logging
   */
  log(level, message, meta = null) {
    logger[level](`[${this.name}] ${message}`, meta);
  }
}

export default BaseExtractor;
