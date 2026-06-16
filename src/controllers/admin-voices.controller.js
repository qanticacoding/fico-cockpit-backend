/**
 * Admin Voices Controller
 * CRUD operations per gestione voci
 */

import logger from '../utils/logger.js';
import VoiceConfigClient from '../storage/voice-config-client.js';

class AdminVoicesController {
  constructor() {
    this.voiceConfigClient = new VoiceConfigClient();
  }

  /**
   * GET /api/admin/voices
   * Lista tutte le voci
   */
  async listVoices(req, res) {
    try {
      const includeInactive = req.query.include_inactive === 'true';
      const voices = this.voiceConfigClient.getAllVoices(includeInactive);
      
      res.json({
        success: true,
        count: voices.length,
        voices
      });
    } catch (error) {
      logger.error('Errore lista voci:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/admin/voices/:id
   * Dettaglio singola voce
   */
  async getVoice(req, res) {
    try {
      const { id } = req.params;
      const voice = this.voiceConfigClient.getVoiceById(id);
      
      if (!voice) {
        return res.status(404).json({ error: `Voce non trovata: ${id}` });
      }
      
      // Include dipendenze
      const dependencies = this.voiceConfigClient.getVoiceDependencies(id);
      const dependents = this.voiceConfigClient.getVoicesDependingOn(id);
      
      res.json({
        success: true,
        voice,
        dependencies,
        dependents
      });
    } catch (error) {
      logger.error('Errore dettaglio voce:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * POST /api/admin/voices
   * Crea nuova voce
   */
  async createVoice(req, res) {
    try {
      const voiceData = req.body;
      
      // Validazione base
      if (!voiceData.id || !voiceData.name || !voiceData.type) {
        return res.status(400).json({
          error: 'Campi obbligatori: id, name, type'
        });
      }
      
      // Verifica tipo valido
      if (!['BASE_A', 'BASE_B', 'CALCULATED'].includes(voiceData.type)) {
        return res.status(400).json({
          error: 'Type deve essere: BASE_A, BASE_B o CALCULATED'
        });
      }
      
      // Validazione tipo-specifica
      if (voiceData.type === 'BASE_A' || voiceData.type === 'BASE_B') {
        if (!voiceData.account_setclass || !voiceData.account_setname) {
          return res.status(400).json({
            error: 'BASE_A/B richiedono: account_setclass, account_setname'
          });
        }
      }
      
      if (voiceData.type === 'BASE_B') {
        if (!voiceData.costcenter_setclass || !voiceData.costcenter_setname) {
          return res.status(400).json({
            error: 'BASE_B richiede anche: costcenter_setclass, costcenter_setname'
          });
        }
      }
      
      if (voiceData.type === 'CALCULATED') {
        if (!voiceData.formula) {
          return res.status(400).json({
            error: 'CALCULATED richiede: formula'
          });
        }
        
        // TODO: Validazione sintattica formula
      }
      
      // Crea voce
      const voice = this.voiceConfigClient.createVoice(voiceData, req.user || 'admin');
      
      res.status(201).json({
        success: true,
        voice
      });
    } catch (error) {
      logger.error('Errore creazione voce:', error);
      
      if (error.message.includes('UNIQUE constraint')) {
        return res.status(409).json({
          error: `Voce con id '${req.body.id}' già esistente`
        });
      }
      
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * PUT /api/admin/voices/:id
   * Aggiorna voce esistente
   */
  async updateVoice(req, res) {
    try {
      const { id } = req.params;
      const voiceData = req.body;
      
      // Verifica esistenza
      const existing = this.voiceConfigClient.getVoiceById(id);
      if (!existing) {
        return res.status(404).json({ error: `Voce non trovata: ${id}` });
      }
      
      // Validazione (stessa del create)
      if (!voiceData.name || !voiceData.type) {
        return res.status(400).json({
          error: 'Campi obbligatori: name, type'
        });
      }
      
      // Aggiorna
      const voice = this.voiceConfigClient.updateVoice(id, voiceData, req.user || 'admin');
      
      res.json({
        success: true,
        voice
      });
    } catch (error) {
      logger.error('Errore aggiornamento voce:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * DELETE /api/admin/voices/:id
   * Elimina voce (soft delete)
   */
  async deleteVoice(req, res) {
    try {
      const { id } = req.params;
      
      const result = this.voiceConfigClient.deleteVoice(id, req.user || 'admin');
      
      res.json(result);
    } catch (error) {
      logger.error('Errore eliminazione voce:', error);
      
      if (error.message.includes('usata da')) {
        return res.status(409).json({ error: error.message });
      }
      
      if (error.message.includes('non trovata')) {
        return res.status(404).json({ error: error.message });
      }
      
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * GET /api/admin/voices/:id/audit
   * Storia modifiche voce
   */
  async getVoiceAudit(req, res) {
    try {
      const { id } = req.params;
      const history = this.voiceConfigClient.getVoiceAuditHistory(id);
      
      res.json({
        success: true,
        voice_id: id,
        history
      });
    } catch (error) {
      logger.error('Errore audit voce:', error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * POST /api/admin/voices/reload
   * Ricarica voice library (dopo modifiche)
   */
  async reloadLibrary(req, res) {
    try {
      // Questo andrà chiamato dal voice executor
      res.json({
        success: true,
        message: 'Voice library verrà ricaricata al prossimo utilizzo'
      });
    } catch (error) {
      logger.error('Errore reload library:', error);
      res.status(500).json({ error: error.message });
    }
  }
}

export default AdminVoicesController;
