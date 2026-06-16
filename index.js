/**
 * SAP SQLite Extractor - Entry Point
 * Sistema di estrazione dati da SAP verso SQLite
 */

import 'dotenv/config';
import express from 'express';
import JobScheduler from './src/scheduler/job-scheduler.js';
import SQLiteClient from './src/storage/sqlite-client.js';
import SapSetClient from './src/clients/sap-set-client.js';
import logger from './src/utils/logger.js';
import registerRoutes from './src/routes/index.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Serve file statici dalla cartella public
app.use(express.static('public'));

// Componenti applicazione
let dbClient;
let scheduler;
let setClient;

/**
 * Inizializzazione applicazione
 */
async function initialize() {
  try {
    logger.info('=== Avvio SAP SQLite Extractor ===');
    
    // Inizializza database
    logger.info('Connessione a SQLite...');
    dbClient = new SQLiteClient();
    await dbClient.connect();
    await dbClient.initSchema();
    logger.info('SQLite connesso e schema inizializzato');
    
    // Inizializza SAP Set Client
    logger.info('Inizializzazione SAP Set Client...');
    setClient = SapSetClient.getInstance({
      enableCache: process.env.ENABLE_SET_CACHE !== 'false',
      cacheTTL: parseInt(process.env.SET_CACHE_TTL) || 5 * 60 * 1000
    });
    logger.info('SAP Set Client inizializzato');
    
    // Inizializza scheduler job
    if (process.env.ENABLE_SCHEDULER === 'true') {
      logger.info('Inizializzazione scheduler job...');
      scheduler = new JobScheduler(dbClient);
      await scheduler.start();
      logger.info('Scheduler avviato con successo');
    } else {
      logger.info('Scheduler disabilitato (ENABLE_SCHEDULER=false)');
    }

    // Registra tutte le route
    registerRoutes(app, { dbClient, scheduler, setClient });
    
    logger.info(`Server avviato su porta ${PORT}`);
  } catch (error) {
    logger.error('Errore durante inizializzazione:', error);
    process.exit(1);
  }
}

/**
 * Graceful shutdown
 */
async function shutdown(signal) {
  logger.info(`Ricevuto segnale ${signal}, chiusura in corso...`);
  
  if (scheduler) {
    await scheduler.stop();
  }
  
  if (dbClient) {
    await dbClient.close();
  }
  
  logger.info('Chiusura completata');
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

/**
 * Avvio server
 */
app.listen(PORT, async () => {
  logger.info(`Server in ascolto su http://localhost:${PORT}`);
  await initialize();
});
