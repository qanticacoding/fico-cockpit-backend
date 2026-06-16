/**
 * Job Runner - Esegue un singolo job di estrazione
 */

import { getExtractor } from '../extractors/index.js';
import { transformSapFiData, validateBatch } from '../processors/transformer.js';
import logger from '../utils/logger.js';
import { retryWithBackoff } from '../utils/error-handler.js';

class JobRunner {
  constructor(dbClient, jobConfig) {
    this.dbClient = dbClient;
    this.jobConfig = jobConfig;
    this.jobId = jobConfig.id;
    this.jobName = jobConfig.name;
  }

  /**
   * Esegue il job completo
   */
  async run() {
    const startTime = new Date();
    logger.info(`\n${'='.repeat(70)}`);
    logger.info(`JOB START: ${this.jobName} (${this.jobId})`);
    logger.info(`${'='.repeat(70)}`);

    try {
      // Log inizio job
      const logId = await this.logJobStart(startTime);

      // Esegui estrattori sequenzialmente
      let totalRecordsExtracted = 0;
      let totalRecordsInserted = 0;

      for (const extractorConfig of this.jobConfig.extractors) {
        const result = await this.runExtractor(extractorConfig);
        totalRecordsExtracted += result.extracted;
        totalRecordsInserted += result.inserted;
      }

      // Log successo
      const endTime = new Date();
      const duration = endTime - startTime;
      
      await this.logJobEnd(logId, {
        status: 'success',
        endTime,
        recordsExtracted: totalRecordsExtracted,
        recordsInserted: totalRecordsInserted
      });

      logger.info(`${'='.repeat(70)}`);
      logger.info(`JOB SUCCESS: ${this.jobName}`);
      logger.info(`Durata: ${duration}ms | Estratti: ${totalRecordsExtracted} | Inseriti: ${totalRecordsInserted}`);
      logger.info(`${'='.repeat(70)}\n`);

      return {
        success: true,
        jobId: this.jobId,
        duration,
        recordsExtracted: totalRecordsExtracted,
        recordsInserted: totalRecordsInserted
      };

    } catch (error) {
      logger.error(`JOB FAILED: ${this.jobName}`, error);
      
      await this.logJobEnd(null, {
        status: 'failed',
        endTime: new Date(),
        errorMessage: error.message
      });

      return {
        success: false,
        jobId: this.jobId,
        error: error.message
      };
    }
  }

  /**
   * Esegue un singolo estrattore
   */
  async runExtractor(extractorConfig) {
    const { name, targetTable, params } = extractorConfig;
    
    logger.info(`\n--- Estrattore: ${name} ---`);
    
    try {
      // Ottieni istanza estrattore
      const extractor = getExtractor(name);
      
      // Esegui estrazione con retry
      const extractResult = await retryWithBackoff(
        () => extractor.run(params),
        this.jobConfig.retryOnError || 3
      );

      if (!extractResult.success) {
        throw new Error(`Estrazione fallita: ${extractResult.error}`);
      }

      const sapData = extractResult.data;
      logger.info(`Estratti ${sapData.length} record da SAP`);

      // Trasforma dati (extraction_date deve essere stringa ISO per SQLite)
      const extractionDate = new Date().toISOString();
      const normalizedData = transformSapFiData(sapData, this.jobId, extractionDate);
      
      if (normalizedData.length === 0) {
        logger.warn('Nessun dato da inserire dopo trasformazione');
        return { extracted: sapData.length, inserted: 0 };
      }

      // Valida dati
      const { valid, invalid } = validateBatch(normalizedData);
      
      if (valid.length === 0) {
        logger.error('Tutti i record sono invalidi dopo validazione');
        throw new Error('Nessun record valido da inserire');
      }

      // Inserisci in database
      const inserted = await this.dbClient.insertBatch(targetTable, valid);
      
      logger.info(`Inseriti ${inserted} record in ${targetTable}`);
      
      if (invalid.length > 0) {
        logger.warn(`${invalid.length} record non validi sono stati scartati`);
      }

      return {
        extracted: sapData.length,
        inserted
      };

    } catch (error) {
      logger.error(`Errore estrattore ${name}:`, error);
      throw error;
    }
  }

  /**
   * Log inizio job
   */
  async logJobStart(startTime) {
    try {
      await this.dbClient.logExtraction({
        jobId: this.jobId,
        jobName: this.jobName,
        startTime,
        status: 'running',
        metadata: {
          extractors: this.jobConfig.extractors.map(e => e.name)
        }
      });
    } catch (error) {
      logger.error('Errore log job start:', error);
    }
  }

  /**
   * Log fine job
   */
  async logJobEnd(logId, data) {
    try {
      await this.dbClient.logExtraction({
        jobId: this.jobId,
        jobName: this.jobName,
        startTime: data.endTime, // Placeholder
        endTime: data.endTime,
        status: data.status,
        recordsExtracted: data.recordsExtracted || 0,
        recordsInserted: data.recordsInserted || 0,
        errorMessage: data.errorMessage || null
      });
    } catch (error) {
      logger.error('Errore log job end:', error);
    }
  }
}

export default JobRunner;
