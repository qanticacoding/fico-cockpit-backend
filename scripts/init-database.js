/**
 * Script di inizializzazione database
 * Esegui con: npm run init-db
 */

import 'dotenv/config';
import SQLiteClient from '../src/storage/sqlite-client.js';
import logger from '../src/utils/logger.js';

async function initDatabase() {
  let client;

  try {
    logger.info('=== Inizializzazione Database SQLite ===\n');

    // Connetti al database
    client = new SQLiteClient();
    await client.connect();

    // Inizializza schema
    await client.initSchema();

    logger.info('\n✅ Database inizializzato con successo!');
    logger.info(`Path database: ${process.env.SQLITE_PATH || './data/sap_data.db'}`);

    // Verifica tabelle create
    const tables = await client.query(`
      SELECT name as table_name
      FROM sqlite_master 
      WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `);

    logger.info('\nTabelle create:');
    tables.forEach(table => {
      logger.info(`  • ${table.table_name}`);
    });

    // Verifica indici
    const indexes = await client.query(`
      SELECT name as index_name
      FROM sqlite_master 
      WHERE type = 'index' AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `);

    logger.info('\nIndici creati:');
    indexes.forEach(index => {
      logger.info(`  • ${index.index_name}`);
    });

    // Statistiche database
    const stats = await client.getStats();
    if (stats) {
      logger.info(`\nStatistiche database:`);
      logger.info(`  • Dimensione: ${stats.sizeMB} MB`);
      logger.info(`  • Pagine: ${stats.pageCount}`);
    }

  } catch (error) {
    logger.error('❌ Errore inizializzazione database:', error);
    process.exit(1);
  } finally {
    if (client) {
      await client.close();
    }
  }
}

// Esegui
initDatabase();
