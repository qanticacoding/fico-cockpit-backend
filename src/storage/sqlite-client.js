/**
 * SQLite Client - Gestione connessione e operazioni database
 * Usa better-sqlite3 (API sincrona, performance ottimali)
 */

import Database from 'better-sqlite3';
import { mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';
import config from '../../config/sqlite.config.js';
import logger from '../utils/logger.js';
import { DatabaseError } from '../utils/error-handler.js';

class SQLiteClient {
  constructor() {
    this.db = null;
  }

  /**
   * Connette al database
   */
  async connect() {
    try {
      logger.info(`Connessione a SQLite: ${config.dbPath}`);
      
      // Crea directory se non esiste
      const dir = dirname(config.dbPath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
        logger.info(`Directory creata: ${dir}`);
      }
      
      // Better-sqlite3 è sincrono, creo wrapper async per compatibilità API
      this.db = new Database(config.dbPath, { 
        verbose: process.env.NODE_ENV === 'development' ? console.log : null 
      });
      
      // Ottimizzazioni performance
      this.db.pragma('journal_mode = WAL'); // Write-Ahead Logging
      this.db.pragma('synchronous = NORMAL'); // Bilanciamento sicurezza/performance
      this.db.pragma('foreign_keys = ON'); // Abilita foreign keys
      
      logger.info('SQLite connesso con successo');
    } catch (error) {
      throw new DatabaseError('connect', error.message, error);
    }
  }

  /**
   * Inizializza schema database
   */
  async initSchema() {
    logger.info('Inizializzazione schema database...');
    
    try {
      // Crea tabella extraction_logs
      this.db.exec(config.schemas.extractionLogs);
      logger.info('Schema extraction_logs creato');
      
      // Crea tabella sap_fi_data
      this.db.exec(config.schemas.sapFiData);
      logger.info('Schema sap_fi_data creato');
      
      // Crea indici
      if (config.indexes && config.indexes.length > 0) {
        config.indexes.forEach(indexSql => {
          this.db.exec(indexSql);
        });
        logger.info(`${config.indexes.length} indici creati`);
      }
      
      logger.info('Schema database inizializzato con successo');
    } catch (error) {
      throw new DatabaseError('initSchema', error.message, error);
    }
  }

  /**
   * Esegue una query senza risultati (DDL, INSERT, UPDATE, DELETE)
   */
  async run(sql, params = []) {
    try {
      if (!this.db) {
        throw new DatabaseError('run', 'Database non connesso');
      }

      const stmt = this.db.prepare(sql);
      const result = stmt.run(...params);
      return result;
    } catch (error) {
      throw new DatabaseError('run', error.message, error);
    }
  }

  /**
   * Esegue una query con risultati (SELECT)
   */
  async query(sql, params = []) {
    try {
      if (!this.db) {
        throw new DatabaseError('query', 'Database non connesso');
      }

      const stmt = this.db.prepare(sql);
      const rows = stmt.all(...params);
      return rows || [];
    } catch (error) {
      throw new DatabaseError('query', error.message, error);
    }
  }

  /**
   * Esegue una query che ritorna un singolo record
   */
  async queryOne(sql, params = []) {
    try {
      if (!this.db) {
        throw new DatabaseError('queryOne', 'Database non connesso');
      }

      const stmt = this.db.prepare(sql);
      const row = stmt.get(...params);
      return row || null;
    } catch (error) {
      throw new DatabaseError('queryOne', error.message, error);
    }
  }

  /**
   * Insert batch di dati con transaction
   */
  async insertBatch(table, data, batchSize = config.batchSize) {
    if (!data || data.length === 0) {
      logger.warn('insertBatch: nessun dato da inserire');
      return 0;
    }

    logger.info(`Inserimento ${data.length} record in ${table}...`);

    try {
      const columns = Object.keys(data[0]);
      const placeholders = columns.map(() => '?').join(',');
      const sql = `INSERT INTO ${table} (${columns.join(',')}) VALUES (${placeholders})`;
      
      logger.debug(`SQL: ${sql}`);
      logger.debug(`Colonne: ${columns.join(', ')}`);
      logger.debug(`Primo record:`, JSON.stringify(data[0]));
      
      const stmt = this.db.prepare(sql);
      
      // Usa transaction per performance massime
      const insertMany = this.db.transaction((records) => {
        for (const record of records) {
          // Converti undefined in null (SQLite non accetta undefined)
          const values = columns.map(col => {
            const val = record[col];
            return val === undefined ? null : val;
          });
          stmt.run(...values);
        }
      });
      
      // Processa in batch per evitare transaction troppo grandi
      let totalInserted = 0;
      for (let i = 0; i < data.length; i += batchSize) {
        const batch = data.slice(i, i + batchSize);
        insertMany(batch);
        totalInserted += batch.length;
        logger.debug(`Batch ${Math.floor(i / batchSize) + 1}: ${batch.length} record inseriti`);
      }

      logger.info(`Totale record inseriti in ${table}: ${totalInserted}`);
      return totalInserted;
    } catch (error) {
      logger.error('Errore inserimento batch:', {
        message: error.message,
        code: error.code,
        stack: error.stack
      });
      throw new DatabaseError('insertBatch', error.message || error.toString(), error);
    }
  }

  /**
   * Crea log estrazione
   */
  async logExtraction(logData) {
    const sql = `
      INSERT INTO extraction_logs 
      (job_id, job_name, extractor_name, start_time, end_time, status, 
       records_extracted, records_inserted, error_message, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await this.run(sql, [
      logData.jobId,
      logData.jobName,
      logData.extractorName || null,
      logData.startTime,
      logData.endTime || null,
      logData.status,
      logData.recordsExtracted || 0,
      logData.recordsInserted || 0,
      logData.errorMessage || null,
      logData.metadata ? JSON.stringify(logData.metadata) : null
    ]);
  }

  /**
   * Esegue VACUUM per ottimizzare database
   */
  async vacuum() {
    try {
      logger.info('Esecuzione VACUUM database...');
      this.db.exec('VACUUM');
      logger.info('VACUUM completato');
    } catch (error) {
      logger.error('Errore VACUUM:', error);
      throw new DatabaseError('vacuum', error.message, error);
    }
  }

  /**
   * Ottiene statistiche database
   */
  async getStats() {
    try {
      const pageCount = this.db.prepare('PRAGMA page_count').get();
      const pageSize = this.db.prepare('PRAGMA page_size').get();
      const freePages = this.db.prepare('PRAGMA freelist_count').get();
      
      const sizeBytes = (pageCount.page_count * pageSize.page_size);
      const freeSizeBytes = (freePages.freelist_count * pageSize.page_size);
      
      return {
        sizeBytes,
        sizeMB: (sizeBytes / 1024 / 1024).toFixed(2),
        freeBytes: freeSizeBytes,
        freeMB: (freeSizeBytes / 1024 / 1024).toFixed(2),
        pageCount: pageCount.page_count,
        pageSize: pageSize.page_size
      };
    } catch (error) {
      logger.error('Errore recupero statistiche:', error);
      return null;
    }
  }

  /**
   * Chiude la connessione
   */
  async close() {
    try {
      if (this.db) {
        logger.info('Chiusura connessione SQLite...');
        this.db.close();
        this.db = null;
        logger.info('Database chiuso con successo');
      }
    } catch (error) {
      logger.error('Errore chiusura database:', error);
      throw new DatabaseError('close', error.message, error);
    }
  }
}

export default SQLiteClient;
