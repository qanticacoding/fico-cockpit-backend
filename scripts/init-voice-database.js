/**
 * Script di inizializzazione Voice Config Database
 * Crea tabelle, indici e trigger per la configurazione voci
 */

import Database from 'better-sqlite3';
import voiceConfigConfig from '../config/voice-config.config.js';
import logger from '../src/utils/logger.js';
import fs from 'fs';
import path from 'path';

async function initVoiceConfigDatabase() {
  logger.info('=== Inizializzazione Voice Config Database ===');
  
  try {
    // Verifica/crea directory config se non esiste
    const dbDir = path.dirname(voiceConfigConfig.dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
      logger.info(`Directory creata: ${dbDir}`);
    }
    
    // Connessione database
    logger.info(`Connessione a: ${voiceConfigConfig.dbPath}`);
    const db = new Database(voiceConfigConfig.dbPath);
    
    // Abilita foreign keys
    db.pragma('foreign_keys = ON');
    
    // Crea tabelle
    logger.info('Creazione tabelle...');
    db.exec(voiceConfigConfig.schemas.voices);
    logger.info('✓ Tabella voices creata');
    
    db.exec(voiceConfigConfig.schemas.voiceDependencies);
    logger.info('✓ Tabella voice_dependencies creata');
    
    db.exec(voiceConfigConfig.schemas.voiceAudit);
    logger.info('✓ Tabella voice_audit creata');
    
    // Crea indici
    logger.info('Creazione indici...');
    voiceConfigConfig.indexes.forEach((indexSql, i) => {
      db.exec(indexSql);
      logger.info(`✓ Indice ${i + 1}/${voiceConfigConfig.indexes.length} creato`);
    });
    
    // Crea trigger
    logger.info('Creazione trigger...');
    voiceConfigConfig.triggers.forEach((triggerSql, i) => {
      db.exec(triggerSql);
      logger.info(`✓ Trigger ${i + 1}/${voiceConfigConfig.triggers.length} creato`);
    });
    
    // Verifica tabelle create
    const tables = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `).all();
    
    logger.info('\nTabelle create:');
    tables.forEach(t => logger.info(`  - ${t.name}`));
    
    // Statistiche
    const stats = {
      tables: tables.length,
      indexes: voiceConfigConfig.indexes.length,
      triggers: voiceConfigConfig.triggers.length
    };
    
    db.close();
    
    logger.info('\n✅ Inizializzazione completata con successo!');
    logger.info(`Statistiche: ${stats.tables} tabelle, ${stats.indexes} indici, ${stats.triggers} trigger`);
    
    return { success: true, stats };
    
  } catch (error) {
    logger.error('❌ Errore inizializzazione database:', error);
    throw error;
  }
}

// Esegui se chiamato direttamente
if (import.meta.url === `file://${process.argv[1]}`) {
  initVoiceConfigDatabase()
    .then(() => process.exit(0))
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}

export default initVoiceConfigDatabase;
