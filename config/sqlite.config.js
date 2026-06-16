/**
 * Configurazione SQLite
 */

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sqliteConfig = {
  // Path del file database
  dbPath: process.env.SQLITE_PATH || path.join(__dirname, '../data/sap_data.db'),
  
  // Batch size per insert
  batchSize: 1000,
  
  // Schema tabelle
  schemas: {
    extractionLogs: `
      CREATE TABLE IF NOT EXISTS extraction_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        job_id TEXT NOT NULL,
        job_name TEXT NOT NULL,
        extractor_name TEXT,
        start_time TEXT NOT NULL,
        end_time TEXT,
        status TEXT NOT NULL,
        records_extracted INTEGER,
        records_inserted INTEGER,
        error_message TEXT,
        metadata TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );
    `,
    
    sapFiData: `
      CREATE TABLE IF NOT EXISTS sap_fi_data (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fiscal_year INTEGER NOT NULL,
        account TEXT NOT NULL,
        account_desc TEXT,
        cost_center TEXT,
        cost_center_desc TEXT,
        fiscal_period INTEGER NOT NULL,
        amount REAL,
        extraction_date TEXT NOT NULL,
        job_id TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
      );
    `
  },
  
  // Indici (creati separatamente dopo le tabelle)
  indexes: [
    // Indici extraction_logs
    'CREATE INDEX IF NOT EXISTS idx_logs_job_id ON extraction_logs(job_id);',
    'CREATE INDEX IF NOT EXISTS idx_logs_status ON extraction_logs(status);',
    'CREATE INDEX IF NOT EXISTS idx_logs_start_time ON extraction_logs(start_time);',
    
    // Indici sap_fi_data (critici per performance query)
    'CREATE INDEX IF NOT EXISTS idx_fi_year ON sap_fi_data(fiscal_year);',
    'CREATE INDEX IF NOT EXISTS idx_fi_account ON sap_fi_data(account);',
    'CREATE INDEX IF NOT EXISTS idx_fi_period ON sap_fi_data(fiscal_period);',
    'CREATE INDEX IF NOT EXISTS idx_fi_cost_center ON sap_fi_data(cost_center);',
    
    // Indice composito per query tipiche (year + account + period)
    'CREATE INDEX IF NOT EXISTS idx_fi_year_account_period ON sap_fi_data(fiscal_year, account, fiscal_period);',
    
    // Indice composito per query con CDC (year + cost_center + period)
    'CREATE INDEX IF NOT EXISTS idx_fi_year_cdc_period ON sap_fi_data(fiscal_year, cost_center, fiscal_period);',
    
    // Indice composito completo per query più complesse
    'CREATE INDEX IF NOT EXISTS idx_fi_year_account_cdc ON sap_fi_data(fiscal_year, account, cost_center);'
  ]
};

export default sqliteConfig;
