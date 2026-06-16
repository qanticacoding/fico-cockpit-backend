/**
 * Script di inizializzazione forzata Voice Config Database
 */

import Database from 'better-sqlite3';
import voiceConfigConfig from '../config/voice-config.config.js';
import fs from 'fs';
import path from 'path';

console.log('=== Inizializzazione Voice Config Database ===\n');

try {
  // Verifica/crea directory config se non esiste
  const dbDir = path.dirname(voiceConfigConfig.dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
    console.log(`✓ Directory creata: ${dbDir}`);
  }
  
  // Connessione database
  console.log(`✓ Connessione a: ${voiceConfigConfig.dbPath}`);
  const db = new Database(voiceConfigConfig.dbPath);
  
  // Abilita foreign keys
  db.pragma('foreign_keys = ON');
  console.log('✓ Foreign keys abilitati');
  
  // Crea tabelle
  console.log('\n📊 Creazione tabelle...');
  
  console.log('  - Tabella voices...');
  db.exec(voiceConfigConfig.schemas.voices);
  console.log('    ✓ voices creata');
  
  console.log('  - Tabella voice_dependencies...');
  db.exec(voiceConfigConfig.schemas.voiceDependencies);
  console.log('    ✓ voice_dependencies creata');
  
  console.log('  - Tabella voice_audit...');
  db.exec(voiceConfigConfig.schemas.voiceAudit);
  console.log('    ✓ voice_audit creata');
  
  // Crea indici
  console.log('\n📑 Creazione indici...');
  voiceConfigConfig.indexes.forEach((indexSql, i) => {
    db.exec(indexSql);
    console.log(`  ✓ Indice ${i + 1}/${voiceConfigConfig.indexes.length} creato`);
  });
  
  // Crea trigger
  console.log('\n⚡ Creazione trigger...');
  voiceConfigConfig.triggers.forEach((triggerSql, i) => {
    db.exec(triggerSql);
    console.log(`  ✓ Trigger ${i + 1}/${voiceConfigConfig.triggers.length} creato`);
  });
  
  // Verifica tabelle create
  const tables = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' AND name NOT LIKE 'sqlite_%'
    ORDER BY name
  `).all();
  
  console.log('\n📋 Tabelle create:');
  tables.forEach(t => console.log(`  - ${t.name}`));
  
  const indexes = db.prepare(`
    SELECT COUNT(*) as cnt FROM sqlite_master 
    WHERE type='index' AND name NOT LIKE 'sqlite_%'
  `).get();
  
  const triggers = db.prepare(`
    SELECT COUNT(*) as cnt FROM sqlite_master 
    WHERE type='trigger'
  `).get();
  
  db.close();
  
  console.log('\n✅ Inizializzazione completata con successo!');
  console.log(`   Tabelle: ${tables.length}`);
  console.log(`   Indici: ${indexes.cnt}`);
  console.log(`   Trigger: ${triggers.cnt}\n`);
  
} catch (error) {
  console.error('\n❌ Errore inizializzazione database:', error.message);
  console.error(error);
  process.exit(1);
}
