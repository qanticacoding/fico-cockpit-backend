/**
 * Configurazione Voice Config Database (SQLite)
 * Database separato per configurazione voci (non dati storici)
 */

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const voiceConfigConfig = {
  // Path del database configurazione
  dbPath: process.env.VOICE_CONFIG_DB_PATH || path.join(__dirname, '../config/voice_config.db'),
  
  // Schema tabelle
  schemas: {
    // Tabella master voci
    voices: `
      CREATE TABLE IF NOT EXISTS voices (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        type TEXT NOT NULL CHECK(type IN ('BASE_A', 'BASE_B', 'CALCULATED')),
        
        -- Per BASE_A e BASE_B
        account_setclass TEXT,
        account_setname TEXT,
        
        -- Solo per BASE_B
        costcenter_setclass TEXT,
        costcenter_setname TEXT,
        
        -- Solo per CALCULATED
        formula TEXT,
        
        -- Common
        sign INTEGER DEFAULT 1,
        category TEXT,
        unit TEXT DEFAULT 'EUR',
        format TEXT DEFAULT 'currency',
        
        -- Metadata
        owner TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        active BOOLEAN DEFAULT 1,
        
        -- Validazioni
        CONSTRAINT check_base_a CHECK (
          type != 'BASE_A' OR (account_setclass IS NOT NULL AND account_setname IS NOT NULL)
        ),
        CONSTRAINT check_base_b CHECK (
          type != 'BASE_B' OR (
            account_setclass IS NOT NULL AND 
            account_setname IS NOT NULL AND 
            costcenter_setclass IS NOT NULL AND 
            costcenter_setname IS NOT NULL
          )
        ),
        CONSTRAINT check_calculated CHECK (
          type != 'CALCULATED' OR formula IS NOT NULL
        )
      );
    `,
    
    // Tabella dipendenze (grafo)
    voiceDependencies: `
      CREATE TABLE IF NOT EXISTS voice_dependencies (
        voice_id TEXT NOT NULL,
        depends_on TEXT NOT NULL,
        
        PRIMARY KEY (voice_id, depends_on),
        FOREIGN KEY (voice_id) REFERENCES voices(id) ON DELETE CASCADE,
        FOREIGN KEY (depends_on) REFERENCES voices(id) ON DELETE RESTRICT
      );
    `,
    
    // Tabella audit log
    voiceAudit: `
      CREATE TABLE IF NOT EXISTS voice_audit (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        voice_id TEXT NOT NULL,
        action TEXT NOT NULL CHECK(action IN ('CREATE', 'UPDATE', 'DELETE')),
        changed_by TEXT,
        changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        old_value TEXT,
        new_value TEXT,
        
        FOREIGN KEY (voice_id) REFERENCES voices(id)
      );
    `
  },
  
  // Indici per performance
  indexes: [
    // Indici voices
    'CREATE INDEX IF NOT EXISTS idx_voices_type ON voices(type);',
    'CREATE INDEX IF NOT EXISTS idx_voices_category ON voices(category);',
    'CREATE INDEX IF NOT EXISTS idx_voices_active ON voices(active);',
    'CREATE INDEX IF NOT EXISTS idx_voices_setname ON voices(account_setname);',
    
    // Indici dipendenze
    'CREATE INDEX IF NOT EXISTS idx_deps_voice ON voice_dependencies(voice_id);',
    'CREATE INDEX IF NOT EXISTS idx_deps_depends ON voice_dependencies(depends_on);',
    
    // Indici audit
    'CREATE INDEX IF NOT EXISTS idx_audit_voice ON voice_audit(voice_id);',
    'CREATE INDEX IF NOT EXISTS idx_audit_action ON voice_audit(action);',
    'CREATE INDEX IF NOT EXISTS idx_audit_date ON voice_audit(changed_at);'
  ],
  
  // Trigger per updated_at automatico
  triggers: [
    `CREATE TRIGGER IF NOT EXISTS update_voices_timestamp 
     AFTER UPDATE ON voices
     FOR EACH ROW
     BEGIN
       UPDATE voices SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
     END;`
  ]
};

export default voiceConfigConfig;
