/**
 * Reports Routes
 * Endpoint CRUD per le definizioni report.
 */

import express from 'express';
import ReportService from '../services/report.service.js';
import ReportsController from '../controllers/reports.controller.js';

export function createReportsRoutes() {
  const router = express.Router();
  const controller = new ReportsController(new ReportService());

  router.get('/', (req, res) => controller.listReports(req, res));
  router.get('/:reportId', (req, res) => controller.getReport(req, res));
  router.post('/', (req, res) => controller.createReport(req, res));
  router.put('/:reportId', (req, res) => controller.updateReport(req, res));
  router.delete('/:reportId', (req, res) => controller.deleteReport(req, res));

  return router;
}
