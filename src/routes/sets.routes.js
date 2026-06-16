/**
 * Sets Routes
 * Route per SAP Set API
 */

import { Router } from 'express';
import SetsController from '../controllers/sets.controller.js';

const router = Router();

/**
 * Crea route per Set API
 */
function createSetsRoutes(setClient) {
  const controller = new SetsController(setClient);

  /**
   * @route GET /api/sets/test
   * @desc Test connettività SAP Set API
   */
  router.get('/test', (req, res) => controller.testConnection(req, res));

  /**
   * @route GET /api/sets/:setclass/:setname
   * @desc Recupera Set SAP
   */
  router.get('/:setclass/:setname', (req, res) => controller.getSet(req, res));

  /**
   * @route GET /api/sets/cache/stats
   * @desc Statistiche cache Set
   */
  router.get('/cache/stats', (req, res) => controller.getCacheStats(req, res));

  /**
   * @route DELETE /api/sets/cache
   * @desc Pulisci cache completa
   */
  router.delete('/cache', (req, res) => controller.clearCache(req, res));

  /**
   * @route DELETE /api/sets/cache/:setclass/:setname
   * @desc Pulisci singolo Set dalla cache
   */
  router.delete('/cache/:setclass/:setname', (req, res) => controller.clearCacheEntry(req, res));

  return router;
}

export default createSetsRoutes;
