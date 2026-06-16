/**
 * Jobs Routes
 * Route per gestione job di estrazione
 */

import { Router } from 'express';
import JobsController from '../controllers/jobs.controller.js';

const router = Router();

/**
 * Crea route per Jobs
 */
function createJobsRoutes(scheduler, dbClient) {
  const controller = new JobsController(scheduler, dbClient);

  /**
   * @route GET /api/jobs
   * @desc Lista job configurati
   */
  router.get('/', (req, res) => controller.listJobs(req, res));

  /**
   * @route POST /api/jobs/:jobId/run
   * @desc Esegui job manualmente
   */
  router.post('/:jobId/run', (req, res) => controller.runJob(req, res));

  /**
   * @route GET /api/jobs/:jobId/status
   * @desc Status ultimo job
   */
  router.get('/:jobId/status', (req, res) => controller.getJobStatus(req, res));

  return router;
}

/**
 * Crea route per Logs (separata, montata su /api/logs)
 */
function createLogsRoutes(dbClient) {
  const logsRouter = Router();
  const controller = new JobsController(null, dbClient);

  /**
   * @route GET /api/logs
   * @desc Ultimi log estrazioni
   */
  logsRouter.get('/', (req, res) => controller.getLogs(req, res));

  return logsRouter;
}

export { createJobsRoutes, createLogsRoutes };
export default createJobsRoutes;
