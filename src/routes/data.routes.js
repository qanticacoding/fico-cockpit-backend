/**
 * Data Routes
 * Route per query dati contabili
 */

import { Router } from 'express';
import DataController from '../controllers/data.controller.js';

const router = Router();

/**
 * Crea route per Data queries
 */
function createDataRoutes(dbClient) {
  const controller = new DataController(dbClient);

  /**
   * @route GET /api/data/fi
   * @desc Query dati contabili FI
   */
  router.get('/fi', (req, res) => controller.queryFiData(req, res));

  return router;
}

export default createDataRoutes;
