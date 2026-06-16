/**
 * Routes Index
 * Aggregatore di tutte le route dell'applicazione
 */

import createHealthRoutes from './health.routes.js';
import createSetsRoutes from './sets.routes.js';
import { createJobsRoutes, createLogsRoutes } from './jobs.routes.js';
import createDataRoutes from './data.routes.js';
import createVoicesRoutes from './voices.routes.js';
import { createReportsRoutes } from './reports.routes.js';
import createAdminVoicesRoutes from './admin-voices.routes.js';

/**
 * Registra tutte le route sull'app Express
 * @param {Express} app - Istanza Express
 * @param {Object} dependencies - Dipendenze (dbClient, scheduler, setClient)
 */
function registerRoutes(app, { dbClient, scheduler, setClient }) {
  // Health check
  app.use('/health', createHealthRoutes(dbClient, scheduler, setClient));

  // API routes
  app.use('/api/sets', createSetsRoutes(setClient));
  app.use('/api/jobs', createJobsRoutes(scheduler, dbClient));
  app.use('/api/logs', createLogsRoutes(dbClient));
  app.use('/api/data', createDataRoutes(dbClient));
  app.use('/api/voices', createVoicesRoutes({ dbClient, setClient }));
  app.use('/api/reports', createReportsRoutes({ dbClient, setClient }));
  
  // Admin routes
  app.use('/api/admin/voices', createAdminVoicesRoutes());

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({
      error: 'Not Found',
      message: `Route ${req.method} ${req.path} non trovata`,
      availableRoutes: [
        'GET /health',
        'GET /api/sets/test',
        'GET /api/sets/:setclass/:setname',
        'GET /api/sets/cache/stats',
        'DELETE /api/sets/cache',
        'GET /api/jobs',
        'POST /api/jobs/:jobId/run',
        'GET /api/jobs/:jobId/status',
        'GET /api/logs',
        'GET /api/data/fi',
        'POST /api/voices/execute',
        'GET /api/voices/library',
        'GET /api/voices/:voiceId',
        'POST /api/voices/reload',
        'POST /api/reports/execute',
        'GET /api/reports',
        'GET /api/reports/:reportId',
        'GET /api/admin/voices',
        'POST /api/admin/voices',
        'GET /api/admin/voices/:id',
        'PUT /api/admin/voices/:id',
        'DELETE /api/admin/voices/:id'
      ]
    });
  });
}

export default registerRoutes;
