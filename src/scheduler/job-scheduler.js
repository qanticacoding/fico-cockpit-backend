/**
 * Job Scheduler - Gestione schedulazione job con node-cron
 */

import cron from 'node-cron';
import jobsConfig from '../../config/jobs.config.js';
import JobRunner from './job-runner.js';
import logger from '../utils/logger.js';

class JobScheduler {
  constructor(dbClient) {
    this.dbClient = dbClient;
    this.scheduledJobs = new Map();
    this.runningJobs = new Map();
  }

  /**
   * Avvia lo scheduler
   */
  async start() {
    logger.info('=== Avvio Job Scheduler ===');
    
    const activeJobs = jobsConfig.getActiveJobs();
    
    if (activeJobs.length === 0) {
      logger.warn('Nessun job attivo da schedulare');
      return;
    }

    logger.info(`Schedulazione di ${activeJobs.length} job...`);

    for (const job of activeJobs) {
      try {
        this.scheduleJob(job);
      } catch (error) {
        logger.error(`Errore schedulazione job ${job.id}:`, error);
      }
    }

    logger.info(`Scheduler avviato con ${this.scheduledJobs.size} job`);
    this.logScheduledJobs();
  }

  /**
   * Schedula un singolo job
   */
  scheduleJob(jobConfig) {
    const { id, schedule, name } = jobConfig;

    // Valida cron expression
    if (!cron.validate(schedule)) {
      throw new Error(`Schedule non valido per job ${id}: ${schedule}`);
    }

    // Crea task cron
    const task = cron.schedule(schedule, async () => {
      await this.executeJob(jobConfig);
    }, {
      scheduled: true,
      timezone: 'Europe/Rome'
    });

    this.scheduledJobs.set(id, {
      task,
      config: jobConfig,
      schedule,
      name
    });

    logger.info(`Job schedulato: ${name} (${id}) - cron: ${schedule}`);
  }

  /**
   * Esegue un job
   */
  async executeJob(jobConfig) {
    const { id } = jobConfig;

    // Verifica se job già in esecuzione
    if (this.runningJobs.has(id)) {
      logger.warn(`Job ${id} già in esecuzione, skip`);
      return;
    }

    try {
      this.runningJobs.set(id, { startTime: new Date() });
      
      const runner = new JobRunner(this.dbClient, jobConfig);
      const result = await runner.run();
      
      this.runningJobs.delete(id);
      
      return result;

    } catch (error) {
      logger.error(`Errore esecuzione job ${id}:`, error);
      this.runningJobs.delete(id);
      throw error;
    }
  }

  /**
   * Esegui job manualmente (on-demand)
   */
  async runJobManually(jobId) {
    const jobConfig = jobsConfig.getJobById(jobId);
    
    if (!jobConfig) {
      throw new Error(`Job non trovato: ${jobId}`);
    }

    logger.info(`Esecuzione manuale job: ${jobId}`);
    return await this.executeJob(jobConfig);
  }

  /**
   * Ferma lo scheduler
   */
  async stop() {
    logger.info('Arresto scheduler...');

    // Ferma tutti i cron job
    for (const [jobId, jobInfo] of this.scheduledJobs) {
      jobInfo.task.stop();
      logger.info(`Job ${jobId} fermato`);
    }

    // Attendi completamento job in esecuzione
    if (this.runningJobs.size > 0) {
      logger.info(`Attendo completamento di ${this.runningJobs.size} job...`);
      // TODO: implementare timeout
    }

    this.scheduledJobs.clear();
    logger.info('Scheduler arrestato');
  }

  /**
   * Ottieni info sui job
   */
  getJobsInfo() {
    const jobs = [];

    for (const [jobId, jobInfo] of this.scheduledJobs) {
      jobs.push({
        id: jobId,
        name: jobInfo.name,
        schedule: jobInfo.schedule,
        enabled: jobInfo.config.enabled,
        running: this.runningJobs.has(jobId),
        extractors: jobInfo.config.extractors.map(e => e.name)
      });
    }

    return jobs;
  }

  /**
   * Log job schedulati
   */
  logScheduledJobs() {
    logger.info('\n--- Job Schedulati ---');
    for (const [jobId, jobInfo] of this.scheduledJobs) {
      logger.info(`  • ${jobInfo.name} (${jobId})`);
      logger.info(`    Schedule: ${jobInfo.schedule}`);
      logger.info(`    Estrattori: ${jobInfo.config.extractors.map(e => e.name).join(', ')}`);
    }
    logger.info('');
  }
}

export default JobScheduler;
