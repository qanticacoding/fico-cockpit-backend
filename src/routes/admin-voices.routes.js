/**
 * Admin Voices Routes
 * API REST per gestione CRUD voci
 */

import { Router } from 'express';
import AdminVoicesController from '../controllers/admin-voices.controller.js';

const router = Router();

/**
 * Crea routes per admin voci
 */
function createAdminVoicesRoutes() {
  const controller = new AdminVoicesController();

  /**
   * @route GET /api/admin/voices
   * @desc Lista tutte le voci
   * @query include_inactive=true per includere voci disattivate
   */
  router.get('/', (req, res) => controller.listVoices(req, res));

  /**
   * @route GET /api/admin/voices/:id
   * @desc Dettaglio singola voce con dipendenze
   */
  router.get('/:id', (req, res) => controller.getVoice(req, res));

  /**
   * @route POST /api/admin/voices
   * @desc Crea nuova voce
   * @body { id, name, type, ... }
   */
  router.post('/', (req, res) => controller.createVoice(req, res));

  /**
   * @route PUT /api/admin/voices/:id
   * @desc Aggiorna voce esistente
   * @body { name, type, ... }
   */
  router.put('/:id', (req, res) => controller.updateVoice(req, res));

  /**
   * @route DELETE /api/admin/voices/:id
   * @desc Elimina voce (soft delete)
   */
  router.delete('/:id', (req, res) => controller.deleteVoice(req, res));

  /**
   * @route GET /api/admin/voices/:id/audit
   * @desc Storia modifiche voce
   */
  router.get('/:id/audit', (req, res) => controller.getVoiceAudit(req, res));

  /**
   * @route POST /api/admin/voices/reload
   * @desc Ricarica voice library
   */
  router.post('/reload', (req, res) => controller.reloadLibrary(req, res));

  return router;
}

export default createAdminVoicesRoutes;
