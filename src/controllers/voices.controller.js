/**
 * Voices Controller
 * Gestisce esecuzione voci dalla voice library
 */

import logger from '../utils/logger.js';
import VoiceExecutor from '../services/voice-executor.js';

class VoicesController {
  constructor(dbClient, setClient) {
    this.executor = new VoiceExecutor(dbClient, setClient);
  }

  /**
   * POST /api/voices/execute
   * Esegue una o più voci dalla libreria
   */
  async executeVoices(req, res) {
    try {
      const {
        voice_ids,
        fiscal_year,
        period_from = 1,
        period_to = 12
      } = req.body;

      // Validazione input
      if (!voice_ids || !Array.isArray(voice_ids) || voice_ids.length === 0) {
        return res.status(400).json({
          error: 'voice_ids è obbligatorio e deve essere un array non vuoto'
        });
      }

      if (!fiscal_year || fiscal_year < 2000 || fiscal_year > 2100) {
        return res.status(400).json({
          error: 'fiscal_year è obbligatorio e deve essere valido'
        });
      }

      if (period_from < 0 || period_from > 12 || period_to < 0 || period_to > 12) {
        return res.status(400).json({
          error: 'period_from e period_to devono essere tra 0 e 12'
        });
      }

      if (period_from > period_to) {
        return res.status(400).json({
          error: 'period_from deve essere <= period_to'
        });
      }

      logger.info(`Richiesta esecuzione voci: ${voice_ids.join(', ')}`);

      // Esegui voci
      const result = await this.executor.executeVoices(voice_ids, {
        fiscal_year,
        period_from,
        period_to
      });

      res.json(result);
    } catch (error) {
      logger.error('Errore esecuzione voci:', error);
      res.status(500).json({
        error: error.message,
        details: error.stack
      });
    }
  }

  /**
   * GET /api/voices/library
   * Restituisce voice library completa
   */
  async getVoiceLibrary(req, res) {
    try {
      // Carica library se necessario
      if (!this.executor.voiceLibrary) {
        await this.executor.loadVoiceLibrary();
      }

      res.json({
        success: true,
        library: this.executor.voiceLibrary,
        total_voices: this.executor.voicesMap.size
      });
    } catch (error) {
      logger.error('Errore recupero voice library:', error);
      res.status(500).json({
        error: error.message
      });
    }
  }

  /**
   * GET /api/voices/:voiceId
   * Restituisce definizione singola voce
   */
  async getVoice(req, res) {
    try {
      const { voiceId } = req.params;

      // Carica library se necessario
      if (!this.executor.voiceLibrary) {
        await this.executor.loadVoiceLibrary();
      }

      const voice = this.executor.getVoice(voiceId);
      
      res.json({
        success: true,
        voice
      });
    } catch (error) {
      if (error.message.includes('non trovata')) {
        return res.status(404).json({
          error: error.message
        });
      }
      
      logger.error('Errore recupero voce:', error);
      res.status(500).json({
        error: error.message
      });
    }
  }

  /**
   * POST /api/voices/reload
   * Ricarica voice library da file
   */
  async reloadLibrary(req, res) {
    try {
      await this.executor.loadVoiceLibrary();
      
      res.json({
        success: true,
        message: 'Voice library ricaricata',
        total_voices: this.executor.voicesMap.size
      });
    } catch (error) {
      logger.error('Errore ricaricamento library:', error);
      res.status(500).json({
        error: error.message
      });
    }
  }
}

export default VoicesController;
