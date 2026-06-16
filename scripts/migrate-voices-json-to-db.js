/**
 * Script di Migrazione Voice Library JSON → SQLite
 * Legge config/voice_library.json e popola voice_config.db
 */

import Database from 'better-sqlite3';
import fs from 'fs/promises';
import voiceConfigConfig from '../config/voice-config.config.js';
import logger from '../src/utils/logger.js';

async function migrateVoicesJsonToDb() {
  logger.info('=== Migrazione Voice Library JSON → SQLite ===');
  
  try {
    // Leggi JSON attuale
    const jsonPath = './config/voice_library.json';
    logger.info(`Lettura file: ${jsonPath}`);
    
    const jsonContent = await fs.readFile(jsonPath, 'utf-8');
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
    
    logger.info(`Trovate ${allVoices.length} voci da migrare`);
    
    // Connessione DB
    const db = new Database(voiceConfigConfig.dbPath);
    db.pragma('foreign_keys = ON');
    
    // Prepara statement insert
    const insertVoice = db.prepare(`
      INSERT INTO voices (
        id, name, description, type, category,
        account_setclass, account_setname,
        costcenter_setclass, costcenter_setname,
        formula, sign, unit, format, owner, active
      ) VALUES (
        @id, @name, @description, @type, @category,
        @account_setclass, @account_setname,
        @costcenter_setclass, @costcenter_setname,
        @formula, @sign, @unit, @format, @owner, 1
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
    
    // Transazione
    const migrateAll = db.transaction(() => {
      let voicesInserted = 0;
      let dependenciesInserted = 0;
      
      allVoices.forEach(voice => {
        // Prepara dati voce
        const voiceData = {
          id: voice.id,
          name: voice.name,
          description: voice.description || null,
          type: voice.type,
          category: voice.category || null,
          
          // BASE_A e BASE_B
          account_setclass: voice.account_set?.setclass || null,
          account_setname: voice.account_set?.setname || null,
          
          // Solo BASE_B
          costcenter_setclass: voice.cost_center_set?.setclass || null,
          costcenter_setname: voice.cost_center_set?.setname || null,
          
          // CALCULATED
          formula: voice.formula || null,
          
          // Common
          sign: voice.sign ?? 1,
          unit: voice.metadata?.unit || 'EUR',
          format: voice.metadata?.format || 'currency',
          owner: voice.metadata?.owner || 'Finance Team'
        };
        
        // Insert voce
        insertVoice.run(voiceData);
        voicesInserted++;
        
        logger.info(`✓ Migrata voce: ${voice.id} (${voice.type})`);
        
        // Insert dipendenze (se CALCULATED)
        if (voice.dependencies && voice.dependencies.length > 0) {
          voice.dependencies.forEach(depId => {
            insertDependency.run(voice.id, depId);
            dependenciesInserted++;
          });
          logger.info(`  └─ Dipendenze: ${voice.dependencies.join(', ')}`);
        }
        
        // Insert audit log
        insertAudit.run(voice.id, JSON.stringify(voiceData));
      });
      
      return { voicesInserted, dependenciesInserted };
    });
    
    // Esegui migrazione
    const stats = migrateAll();
    
    // Verifica
    const voiceCount = db.prepare('SELECT COUNT(*) as count FROM voices').get();
    const depCount = db.prepare('SELECT COUNT(*) as count FROM voice_dependencies').get();
    
    db.close();
    
    logger.info('\n✅ Migrazione completata con successo!');
    logger.info(`Statistiche:`);
    logger.info(`  - Voci migrate: ${stats.voicesInserted}`);
    logger.info(`  - Dipendenze create: ${stats.dependenciesInserted}`);
    logger.info(`  - Voci totali in DB: ${voiceCount.count}`);
    logger.info(`  - Dipendenze totali in DB: ${depCount.count}`);
    
    // Chiedi conferma per eliminare JSON
    logger.info(`\n⚠️  Ora puoi eliminare manualmente il file: ${jsonPath}`);
    logger.info(`   oppure esegui: rm ${jsonPath}`);
    
    return { success: true, stats };
    
  } catch (error) {
    logger.error('❌ Errore migrazione:', error);
    throw error;
  }
}

// Esegui se chiamato direttamente
if (import.meta.url === `file://${process.argv[1]}`) {
  migrateVoicesJsonToDb()
    .then(() => process.exit(0))
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}

export default migrateVoicesJsonToDb;
