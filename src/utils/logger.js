/**
 * Logger - Sistema di logging centralizzato
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

class Logger {
  constructor() {
    this.logLevel = LOG_LEVELS[process.env.LOG_LEVEL?.toUpperCase()] || LOG_LEVELS.INFO;
    this.logFilePath = process.env.LOG_FILE_PATH || path.join(__dirname, '../../logs/app.log');
    
    // Assicura che la cartella logs esista
    const logDir = path.dirname(this.logFilePath);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  }

  /**
   * Formatta messaggio log
   */
  formatMessage(level, message, meta = null) {
    const timestamp = new Date().toISOString();
    let formatted = `[${timestamp}] [${level}] ${message}`;
    
    if (meta) {
      formatted += ' ' + JSON.stringify(meta);
    }
    
    return formatted;
  }

  /**
   * Scrive log su file
   */
  writeToFile(message) {
    try {
      fs.appendFileSync(this.logFilePath, message + '\n', 'utf8');
    } catch (error) {
      console.error('Errore scrittura log su file:', error);
    }
  }

  /**
   * Log generico
   */
  log(level, message, meta = null) {
    const levelValue = LOG_LEVELS[level];
    
    if (levelValue <= this.logLevel) {
      const formatted = this.formatMessage(level, message, meta);
      
      // Console output con colori
      switch (level) {
        case 'ERROR':
          console.error('\x1b[31m%s\x1b[0m', formatted);
          break;
        case 'WARN':
          console.warn('\x1b[33m%s\x1b[0m', formatted);
          break;
        case 'INFO':
          console.info('\x1b[36m%s\x1b[0m', formatted);
          break;
        case 'DEBUG':
          console.debug('\x1b[90m%s\x1b[0m', formatted);
          break;
      }
      
      // File output
      this.writeToFile(formatted);
    }
  }

  error(message, meta = null) {
    this.log('ERROR', message, meta);
  }

  warn(message, meta = null) {
    this.log('WARN', message, meta);
  }

  info(message, meta = null) {
    this.log('INFO', message, meta);
  }

  debug(message, meta = null) {
    this.log('DEBUG', message, meta);
  }
}

// Esporta istanza singleton
export default new Logger();
