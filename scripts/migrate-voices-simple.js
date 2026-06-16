/**
 * Migrazione semplice Voice Library JSON → SQLite
 */

import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('\n=== Migrazione Voice Library JSON → SQLite ===\n');

try {
  // Leggi JSON
  const jsonPath = path.join(__dirname, '../config/voice_library.json');
  console.log(`📖 Lettura file: ${jsonPath}`);
  
  const jsonContent = fs.readFileSync(jsonPath, 'utf-8');
  const library = JSON.parse(jsonContent);
  
  // Estrai voci
  const allVoices = [];
  library.voices.forEach(category => {
    category.voices.forEach(voice => {
      allVoices.push({
        ...voice,
        category: category.category
      });
    });
  });
  
  console.log(`✓ Trovate ${allVoices.length} voci da migrare\n`);
  
  // Connessione DB
  const dbPath = path.join(__dirname, '../config/voice_config.db');
  console.log(`🔌 Connessione a: ${dbPath}`);
  const db = new Database(dbPath);
  db.pragma('foreign_keys = ON');
  
  // Prepara statement
  const insertVoice = db.prepare(`
    INSERT INTO voices (
      id, name, description, type, category,
      account_setclass, account_setname,
      costcenter_setclass, costcenter_setname,
      formula, sign, unit, format, owner, active
    ) VALUES (
      ?, ?, ?, ?, ?,
      ?, ?,
      ?, ?,
      ?, ?, ?, ?, ?, 1
    )
  `);
  
  const insertDependency = db.prepare(`
    INSERT INTO voice_dependencies (voice_id, depends_on)
    VALUES (?, ?)
  `);
  
  const insertAudit = db.prepare(`
    INSERT INTO voice_audit (voice_id, action, changed_by, new_value)
    VALUES (?, 'CREATE', 'migration_script', ?)
  `);
  
  // Migra ogni voce
  let voicesInserted = 0;
  let dependenciesInserted = 0;
  
  const migrateAll = db.transaction(() => {
    allVoices.forEach(voice => {
      console.log(`\n📝 Migrando: ${voice.id}`);
      console.log(`   Tipo: ${voice.type}`);
      
      // Prepara dati
      const params = [
        voice.id,
        voice.name,
        voice.description || null,
        voice.type,
        voice.category || null,
        voice.account_set?.setclass || null,
        voice.account_set?.setname || null,
        voice.cost_center_set?.setclass || null,
        voice.cost_center_set?.setname || null,
        voice.formula || null,
        voice.sign ?? 1,
        voice.metadata?.unit || 'EUR',
        voice.metadata?.format || 'currency',
        voice.metadata?.owner || 'Finance Team'
      ];
      
      // Insert voce
      insertVoice.run(...params);
      voicesInserted++;
      console.log(`   ✓ Voce inserita`);
      
      // Insert dipendenze
      if (voice.dependencies && voice.dependencies.length > 0) {
        voice.dependencies.forEach(depId => {
          insertDependency.run(voice.id, depId);
          dependenciesInserted++;
          console.log(`   ✓ Dipendenza: ${depId}`);
        });
      }
      
      // Insert audit
      insertAudit.run(voice.id, JSON.stringify(voice));
    });
  });
  
  console.log('\n🔄 Esecuzione transazione...');
  migrateAll();
  
  // Verifica
  const voiceCount = db.prepare('SELECT COUNT(*) as count FROM voices').get();
  const depCount = db.prepare('SELECT COUNT(*) as count FROM voice_dependencies').get();
  const auditCount = db.prepare('SELECT COUNT(*) as count FROM voice_audit').get();
  
  db.close();
  
  console.log('\n✅ Migrazione completata con successo!\n');
  console.log('📊 Statistiche:');
  console.log(`   - Voci migrate: ${voicesInserted}`);
  console.log(`   - Dipendenze create: ${dependenciesInserted}`);
  console.log(`   - Voci in DB: ${voiceCount.count}`);
  console.log(`   - Dipendenze in DB: ${depCount.count}`);
  console.log(`   - Audit log: ${auditCount.count}`);
  console.log('');
  
} catch (error) {
  console.error('\n❌ Errore migrazione:', error.message);
  console.error(error);
  process.exit(1);
}
