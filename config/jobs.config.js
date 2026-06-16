/**
 * Configurazione Job di estrazione
 */

import jobs from '../jobs/extraction-jobs.js';

const jobsConfig = {
  jobs,
  
  // Configurazioni globali job
  globalConfig: {
    retryAttempts: parseInt(process.env.JOB_RETRY_ATTEMPTS) || 3,
    timeout: parseInt(process.env.JOB_TIMEOUT) || 3600000, // 1 ora
    retryDelay: 5000 // 5 secondi tra retry
  },
  
  /**
   * Trova job per ID
   */
  getJobById(jobId) {
    return jobs.find(job => job.id === jobId);
  },
  
  /**
   * Ottiene tutti i job attivi
   */
  getActiveJobs() {
    return jobs.filter(job => job.enabled);
  },
  
  /**
   * Valida configurazione job
   */
  validateJob(job) {
    if (!job.id || !job.schedule || !job.extractors || job.extractors.length === 0) {
      throw new Error(`Job ${job.id || 'unknown'} non valido: manca id, schedule o extractors`);
    }
    return true;
  }
};

export default jobsConfig;
