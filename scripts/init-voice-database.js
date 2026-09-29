/**
 * Script di inizializzazione Configuration Database.
 * Crea schema voci e report nello stesso SQLite di configurazione.
 */

import Database from 'better-sqlite3';
import voiceConfigConfig from '../config/voice-config.config.js';
import reportConfig from '../config/report-config.config.js';
import logger from '../src/utils/logger.js';
import fs from 'fs';
import path from 'path';

async function initVoiceConfigDatabase() {
  logger.info('=== Inizializzazione Configuration Database ===');

  try {
    const dbDir = path.dirname(voiceConfigConfig.dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
      logger.info(`Directory creata: ${dbDir}`);
    }

    logger.info(`Connessione a: ${voiceConfigConfig.dbPath}`);
    const db = new Database(voiceConfigConfig.dbPath);
    db.pragma('foreign_keys = ON');

    logger.info('Creazione schema voci...');
    db.exec(voiceConfigConfig.schemas.voices);
    db.exec(voiceConfigConfig.schemas.voiceDependencies);
    db.exec(voiceConfigConfig.schemas.voiceAudit);

    voiceConfigConfig.indexes.forEach(indexSql => db.exec(indexSql));
    voiceConfigConfig.triggers.forEach(triggerSql => db.exec(triggerSql));

    logger.info('Creazione schema report...');
    db.exec(reportConfig.schemas.reports);
    db.exec(reportConfig.schemas.reportVoices);

    reportConfig.indexes.forEach(indexSql => db.exec(indexSql));
    reportConfig.triggers.forEach(triggerSql => db.exec(triggerSql));

    const tables = db.prepare(`
      SELECT name FROM sqlite_master
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `).all();

    logger.info('\nTabelle disponibili:');
    tables.forEach(t => logger.info(`  - ${t.name}`));

    const stats = {
      tables: tables.length,
      indexes: voiceConfigConfig.indexes.length + reportConfig.indexes.length,
      triggers: voiceConfigConfig.triggers.length + reportConfig.triggers.length
    };

    db.close();

    logger.info('\n✅ Inizializzazione completata con successo!');
    logger.info(
      `Statistiche: ${stats.tables} tabelle, ${stats.indexes} indici, ${stats.triggers} trigger`
    );

    return { success: true, stats };
  } catch (error) {
    logger.error('❌ Errore inizializzazione database:', error);
    throw error;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  initVoiceConfigDatabase()
    .then(() => process.exit(0))
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}

export default initVoiceConfigDatabase;
