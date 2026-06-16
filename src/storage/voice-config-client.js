/**
 * Voice Config SQLite Client
 * Client per gestire CRUD voci dalla configurazione SQLite
 */

import Database from 'better-sqlite3';
import voiceConfigConfig from '../../config/voice-config.config.js';
import logger from '../utils/logger.js';

class VoiceConfigClient {
  constructor() {
    this.db = null;
    this.dbPath = voiceConfigConfig.dbPath;
  }

  /**
   * Connetti al database
   */
  connect() {
    if (!this.db) {
      try {
        this.db = new Database(this.dbPath);
        this.db.pragma('foreign_keys = ON');
        logger.info(`Voice Config DB connesso: ${this.dbPath}`);
      } catch (error) {
        logger.error('Errore connessione Voice Config DB:', error);
        throw error;
      }
    }
    return this.db;
  }

  /**
   * Disconnetti dal database
   */
  disconnect() {
    if (this.db) {
      this.db.close();
      this.db = null;
      logger.info('Voice Config DB disconnesso');
    }
  }

  /**
   * GET: Tutte le voci attive
   */
  getAllVoices(includeInactive = false) {
    this.connect();
    const query = includeInactive 
      ? 'SELECT * FROM voices ORDER BY category, id'
      : 'SELECT * FROM voices WHERE active = 1 ORDER BY category, id';
    
    return this.db.prepare(query).all();
  }

  /**
   * GET: Singola voce per ID
   */
  getVoiceById(voiceId) {
    this.connect();
    return this.db.prepare('SELECT * FROM voices WHERE id = ?').get(voiceId);
  }

  /**
   * GET: Dipendenze di una voce
   */
  getVoiceDependencies(voiceId) {
    this.connect();
    return this.db.prepare(`
      SELECT depends_on FROM voice_dependencies 
      WHERE voice_id = ?
    `).all(voiceId).map(row => row.depends_on);
  }

  /**
   * GET: Voci che dipendono da una voce specifica
   */
  getVoicesDependingOn(voiceId) {
    this.connect();
    return this.db.prepare(`
      SELECT voice_id FROM voice_dependencies 
      WHERE depends_on = ?
    `).all(voiceId).map(row => row.voice_id);
  }

  /**
   * GET: Tutte le voci con dipendenze (formato executor)
   */
  getVoicesWithDependencies() {
    this.connect();
    const voices = this.getAllVoices();
    
    return voices.map(voice => {
      const dependencies = this.getVoiceDependencies(voice.id);
      
      // Formato compatibile con executor attuale
      const voiceData = {
        id: voice.id,
        name: voice.name,
        description: voice.description,
        type: voice.type,
        sign: voice.sign,
        metadata: {
          unit: voice.unit,
          format: voice.format,
          owner: voice.owner,
          category: voice.category
        }
      };
      
      // Aggiungi campi specifici per tipo
      if (voice.type === 'BASE_A' || voice.type === 'BASE_B') {
        voiceData.account_set = {
          setclass: voice.account_setclass,
          setname: voice.account_setname
        };
      }
      
      if (voice.type === 'BASE_B') {
        voiceData.cost_center_set = {
          setclass: voice.costcenter_setclass,
          setname: voice.costcenter_setname
        };
      }
      
      if (voice.type === 'CALCULATED') {
        voiceData.formula = voice.formula;
        voiceData.dependencies = dependencies;
      }
      
      return voiceData;
    });
  }

  /**
   * POST: Crea nuova voce
   */
  createVoice(voiceData, changedBy = 'admin') {
    this.connect();
    
    const insert = this.db.prepare(`
      INSERT INTO voices (
        id, name, description, type, category,
        account_setclass, account_setname,
        costcenter_setclass, costcenter_setname,
        formula, sign, unit, format, owner
      ) VALUES (
        @id, @name, @description, @type, @category,
        @account_setclass, @account_setname,
        @costcenter_setclass, @costcenter_setname,
        @formula, @sign, @unit, @format, @owner
      )
    `);
    
    const insertDep = this.db.prepare(`
      INSERT INTO voice_dependencies (voice_id, depends_on)
      VALUES (?, ?)
    `);
    
    const audit = this.db.prepare(`
      INSERT INTO voice_audit (voice_id, action, changed_by, new_value)
      VALUES (?, 'CREATE', ?, ?)
    `);
    
    const transaction = this.db.transaction(() => {
      // Insert voce
      insert.run(voiceData);
      
      // Insert dipendenze
      if (voiceData.dependencies && voiceData.dependencies.length > 0) {
        voiceData.dependencies.forEach(depId => {
          insertDep.run(voiceData.id, depId);
        });
      }
      
      // Audit log
      audit.run(voiceData.id, changedBy, JSON.stringify(voiceData));
    });
    
    transaction();
    logger.info(`Voce creata: ${voiceData.id}`);
    
    return this.getVoiceById(voiceData.id);
  }

  /**
   * PUT: Aggiorna voce esistente
   */
  updateVoice(voiceId, voiceData, changedBy = 'admin') {
    this.connect();
    
    // Salva valore vecchio per audit
    const oldVoice = this.getVoiceById(voiceId);
    if (!oldVoice) {
      throw new Error(`Voce non trovata: ${voiceId}`);
    }
    
    const update = this.db.prepare(`
      UPDATE voices SET
        name = @name,
        description = @description,
        type = @type,
        category = @category,
        account_setclass = @account_setclass,
        account_setname = @account_setname,
        costcenter_setclass = @costcenter_setclass,
        costcenter_setname = @costcenter_setname,
        formula = @formula,
        sign = @sign,
        unit = @unit,
        format = @format,
        owner = @owner
      WHERE id = @id
    `);
    
    const deleteDeps = this.db.prepare('DELETE FROM voice_dependencies WHERE voice_id = ?');
    const insertDep = this.db.prepare('INSERT INTO voice_dependencies (voice_id, depends_on) VALUES (?, ?)');
    
    const audit = this.db.prepare(`
      INSERT INTO voice_audit (voice_id, action, changed_by, old_value, new_value)
      VALUES (?, 'UPDATE', ?, ?, ?)
    `);
    
    const transaction = this.db.transaction(() => {
      // Update voce
      update.run({ ...voiceData, id: voiceId });
      
      // Aggiorna dipendenze
      deleteDeps.run(voiceId);
      if (voiceData.dependencies && voiceData.dependencies.length > 0) {
        voiceData.dependencies.forEach(depId => {
          insertDep.run(voiceId, depId);
        });
      }
      
      // Audit log
      audit.run(voiceId, changedBy, JSON.stringify(oldVoice), JSON.stringify(voiceData));
    });
    
    transaction();
    logger.info(`Voce aggiornata: ${voiceId}`);
    
    return this.getVoiceById(voiceId);
  }

  /**
   * DELETE: Elimina voce (soft delete)
   */
  deleteVoice(voiceId, changedBy = 'admin') {
    this.connect();
    
    // Verifica se altre voci dipendono da questa
    const dependents = this.getVoicesDependingOn(voiceId);
    if (dependents.length > 0) {
      throw new Error(
        `Impossibile eliminare ${voiceId}: usata da ${dependents.join(', ')}`
      );
    }
    
    const oldVoice = this.getVoiceById(voiceId);
    if (!oldVoice) {
      throw new Error(`Voce non trovata: ${voiceId}`);
    }
    
    // Soft delete
    const update = this.db.prepare('UPDATE voices SET active = 0 WHERE id = ?');
    const audit = this.db.prepare(`
      INSERT INTO voice_audit (voice_id, action, changed_by, old_value)
      VALUES (?, 'DELETE', ?, ?)
    `);
    
    const transaction = this.db.transaction(() => {
      update.run(voiceId);
      audit.run(voiceId, changedBy, JSON.stringify(oldVoice));
    });
    
    transaction();
    logger.info(`Voce eliminata (soft): ${voiceId}`);
    
    return { success: true, voiceId };
  }

  /**
   * GET: Storia audit di una voce
   */
  getVoiceAuditHistory(voiceId) {
    this.connect();
    return this.db.prepare(`
      SELECT * FROM voice_audit 
      WHERE voice_id = ? 
      ORDER BY changed_at DESC
    `).all(voiceId);
  }
}

export default VoiceConfigClient;
