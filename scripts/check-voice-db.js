/**
 * Script per verificare lo stato del database voice_config
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '../config/voice_config.db');

console.log(`\n🔍 Verifica database: ${dbPath}\n`);

try {
  const db = new Database(dbPath);
  
  // Verifica tabelle
  const tables = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' AND name NOT LIKE 'sqlite_%'
    ORDER BY name
  `).all();
  
  console.log('📊 Tabelle trovate:');
  if (tables.length === 0) {
    console.log('   ⚠️  Nessuna tabella trovata! Database non inizializzato.');
  } else {
    tables.forEach(t => {
      const count = db.prepare(`SELECT COUNT(*) as cnt FROM ${t.name}`).get();
      console.log(`   ✓ ${t.name} (${count.cnt} righe)`);
    });
  }
  
  // Verifica indici
  const indexes = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='index' AND name NOT LIKE 'sqlite_%'
    ORDER BY name
  `).all();
  
  console.log(`\n📑 Indici trovati: ${indexes.length}`);
  
  // Verifica trigger
  const triggers = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='trigger'
    ORDER BY name
  `).all();
  
  console.log(`⚡ Trigger trovati: ${triggers.length}`);
  
  db.close();
  console.log('\n✅ Verifica completata\n');
  
} catch (error) {
  console.error('\n❌ Errore:', error.message);
  process.exit(1);
}
