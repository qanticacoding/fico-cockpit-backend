/**
 * Voices Routes
 * Routing per esecuzione voci dalla voice library
 */

import express from 'express';

function createVoicesRoutes({ dbClient, setClient }) {
  const router = express.Router();
  
  // Lazy import del controller per evitare dipendenze circolari
  let VoicesController;
  let controller;
  
  const getController = async () => {
    if (!controller) {
      if (!VoicesController) {
        const module = await import('../controllers/voices.controller.js');
        VoicesController = module.default;
      }
      controller = new VoicesController(dbClient, setClient);
    }
    return controller;
  };

  /**
   * POST /api/voices/execute
   * Esegue una o più voci dalla libreria
   * 
   * Body:
   * {
   *   "voice_ids": ["costo_venduto", "margine_industriale"],
   *   "fiscal_year": 2025,
   *   "period_from": 1,
   *   "period_to": 12
   * }
   */
  router.post('/execute', async (req, res) => {
    const ctrl = await getController();
    ctrl.executeVoices(req, res);
  });

  /**
   * GET /api/voices/library
   * Restituisce voice library completa
   */
  router.get('/library', async (req, res) => {
    const ctrl = await getController();
    ctrl.getVoiceLibrary(req, res);
  });

  /**
   * GET /api/voices/:voiceId
   * Restituisce definizione singola voce
   */
  router.get('/:voiceId', async (req, res) => {
    const ctrl = await getController();
    ctrl.getVoice(req, res);
  });

  /**
   * POST /api/voices/reload
   * Ricarica voice library da file
   */
  router.post('/reload', async (req, res) => {
    const ctrl = await getController();
    ctrl.reloadLibrary(req, res);
  });

  return router;
}

export default createVoicesRoutes;
