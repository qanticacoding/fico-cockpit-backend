/**
 * Sets Controller
 * Logica per gestione SAP Set API
 */

import logger from '../utils/logger.js';

class SetsController {
  constructor(setClient) {
    this.setClient = setClient;
  }

  /**
   * Test connettività SAP Set API
   */
  async testConnection(req, res) {
    if (!this.setClient) {
      return res.status(503).json({ error: 'Set Client non disponibile' });
    }

    try {
      const result = await this.setClient.testConnection();
      res.json(result);
    } catch (error) {
      logger.error('Errore test connessione Set API:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Recupera Set SAP
   */
  async getSet(req, res) {
    if (!this.setClient) {
      return res.status(503).json({ error: 'Set Client non disponibile' });
    }

    const { setclass, setname } = req.params;

    try {
      logger.info(`Richiesta Set: ${setclass}/${setname}`);
      const result = await this.setClient.fetchSet(setclass, setname);
      res.json(result);
    } catch (error) {
      logger.error(`Errore recupero Set ${setclass}/${setname}:`, error);
      res.status(500).json({
        error: error.message,
        setclass,
        setname
      });
    }
  }

  /**
   * Statistiche cache Set
   */
  getCacheStats(req, res) {
    if (!this.setClient) {
      return res.status(503).json({ error: 'Set Client non disponibile' });
    }

    const stats = this.setClient.getCacheStats();
    res.json(stats);
  }

  /**
   * Pulisci cache completa
   */
  clearCache(req, res) {
    if (!this.setClient) {
      return res.status(503).json({ error: 'Set Client non disponibile' });
    }

    const result = this.setClient.clearCache();
    res.json({
      success: true,
      ...result
    });
  }

  /**
   * Pulisci singolo Set dalla cache
   */
  clearCacheEntry(req, res) {
    if (!this.setClient) {
      return res.status(503).json({ error: 'Set Client non disponibile' });
    }

    const { setclass, setname } = req.params;
    const result = this.setClient.clearCacheEntry(setclass, setname);
    res.json({
      success: true,
      setclass,
      setname,
      ...result
    });
  }
}

export default SetsController;
