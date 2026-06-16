/**
 * Jobs Controller
 * Logica per gestione job di estrazione
 */

import logger from '../utils/logger.js';

class JobsController {
  constructor(scheduler, dbClient) {
    this.scheduler = scheduler;
    this.dbClient = dbClient;
  }

  /**
   * Lista job configurati
   */
  listJobs(req, res) {
    if (!this.scheduler) {
      return res.status(503).json({ error: 'Scheduler non disponibile' });
    }

    res.json(this.scheduler.getJobsInfo());
  }

  /**
   * Esegui job manualmente
   */
  async runJob(req, res) {
    const { jobId } = req.params;

    if (!this.scheduler) {
      return res.status(503).json({ error: 'Scheduler non disponibile' });
    }

    try {
      logger.info(`Esecuzione manuale job: ${jobId}`);
      await this.scheduler.runJobManually(jobId);
      res.json({
        success: true,
        message: `Job ${jobId} avviato`,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error(`Errore esecuzione job ${jobId}:`, error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Status ultimo job
   */
  async getJobStatus(req, res) {
    const { jobId } = req.params;

    if (!this.dbClient) {
      return res.status(503).json({ error: 'Database non disponibile' });
    }

    try {
      const result = await this.dbClient.query(
        `SELECT * FROM extraction_logs 
         WHERE job_id = ? 
         ORDER BY start_time DESC 
         LIMIT 1`,
        [jobId]
      );

      if (result.length === 0) {
        return res.status(404).json({ error: 'Job non trovato' });
      }

      res.json(result[0]);
    } catch (error) {
      logger.error(`Errore recupero status job ${jobId}:`, error);
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Ultimi log estrazioni
   */
  async getLogs(req, res) {
    const limit = parseInt(req.query.limit) || 50;
    const status = req.query.status;

    if (!this.dbClient) {
      return res.status(503).json({ error: 'Database non disponibile' });
    }

    try {
      let query = 'SELECT * FROM extraction_logs';
      const params = [];

      if (status) {
        query += ' WHERE status = ?';
        params.push(status);
      }

      query += ' ORDER BY start_time DESC LIMIT ?';
      params.push(limit);

      const result = await this.dbClient.query(query, params);
      res.json(result);
    } catch (error) {
      logger.error('Errore recupero logs:', error);
      res.status(500).json({ error: error.message });
    }
  }
}

export default JobsController;
