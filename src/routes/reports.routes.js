/**
 * Reports Routes
 * Endpoint per esecuzione e gestione report
 */

import express from 'express';

export function createReportsRoutes({ dbClient, setClient }) {
  const router = express.Router();
  
  // Lazy import del controller e servizi
  let controller;
  const getController = async () => {
    if (!controller) {
      const { default: VoiceExecutor } = await import('../services/voice-executor.js');
      const { default: ReportExecutor } = await import('../services/report-executor.js');
      const { default: ReportsController } = await import('../controllers/reports.controller.js');
      
      // Crea VoiceExecutor
      const voiceExecutor = new VoiceExecutor(dbClient, setClient);
      await voiceExecutor.loadVoiceLibrary(); // Carica libreria voci
      
      // Crea ReportExecutor con VoiceExecutor
      const reportExecutor = new ReportExecutor(voiceExecutor);
      await reportExecutor.loadReportsLibrary(); // Carica libreria report
      
      // Crea controller
      controller = new ReportsController(reportExecutor);
    }
    return controller;
  };

  // POST /api/reports/execute - Esegue un report
  router.post('/execute', async (req, res) => {
    const ctrl = await getController();
    await ctrl.executeReport(req, res);
  });

  // GET /api/reports - Lista tutti i report disponibili
  router.get('/', async (req, res) => {
    const ctrl = await getController();
    await ctrl.listReports(req, res);
  });

  // GET /api/reports/:reportId - Dettaglio configurazione report
  router.get('/:reportId', async (req, res) => {
    const ctrl = await getController();
    await ctrl.getReport(req, res);
  });

  return router;
}
