/**
 * Health Routes
 * Route per health check e status applicazione
 */

import { Router } from 'express';

const router = Router();

/**
 * @route GET /health
 * @desc Health check applicazione
 */
function createHealthRoutes(dbClient, scheduler, setClient) {
  router.get('/', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: dbClient ? 'connected' : 'disconnected',
      scheduler: scheduler ? 'running' : 'stopped',
      setClient: setClient ? 'initialized' : 'not initialized'
    });
  });

  return router;
}

export default createHealthRoutes;
