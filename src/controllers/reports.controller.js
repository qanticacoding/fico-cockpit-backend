/**
 * Reports Controller
 * CRUD delle definizioni report.
 * Il controller non esegue report e non calcola voci.
 */

import logger from '../utils/logger.js';

class ReportsController {
  constructor(reportService) {
    this.reportService = reportService;
  }

  async listReports(req, res) {
    try {
      const filters = {};

      if (req.query.class) {
        filters.reportClass = req.query.class;
      }

      if (req.query.enabled !== undefined) {
        if (!['true', 'false'].includes(req.query.enabled)) {
          return res.status(400).json({
            success: false,
            error: 'enabled deve essere true o false'
          });
        }
        filters.enabled = req.query.enabled === 'true';
      }

      const reports = this.reportService.list(filters);

      res.json({
        success: true,
        reports,
        total: reports.length
      });
    } catch (error) {
      logger.error('Errore lista report:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Errore interno del server'
      });
    }
  }

  async getReport(req, res) {
    try {
      const report = this.reportService.getById(req.params.reportId);

      res.json({
        success: true,
        report
      });
    } catch (error) {
      logger.error(`Errore dettaglio report ${req.params.reportId}:`, error);

      if (error.message.includes('non trovato')) {
        return res.status(404).json({
          success: false,
          error: error.message
        });
      }

      res.status(500).json({
        success: false,
        error: error.message || 'Errore interno del server'
      });
    }
  }

  async createReport(req, res) {
    try {
      const report = this.reportService.create(req.body);

      res.status(201).json({
        success: true,
        report
      });
    } catch (error) {
      logger.error('Errore creazione report:', error);

      if (error.code === 'REPORT_VALIDATION_ERROR') {
        return res.status(400).json({ success: false, error: error.message });
      }

      if (error.code === 'REPORT_VOICES_NOT_FOUND') {
        return res.status(400).json({ success: false, error: error.message });
      }

      if (error.message.includes('già esistente')) {
        return res.status(409).json({ success: false, error: error.message });
      }

      res.status(500).json({
        success: false,
        error: error.message || 'Errore interno del server'
      });
    }
  }

  async updateReport(req, res) {
    try {
      if (!req.body || Object.keys(req.body).length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Body vuoto: nessun campo da aggiornare'
        });
      }

      const report = this.reportService.update(req.params.reportId, req.body);

      res.json({
        success: true,
        report
      });
    } catch (error) {
      logger.error(`Errore aggiornamento report ${req.params.reportId}:`, error);

      if (error.message.includes('non trovato')) {
        return res.status(404).json({ success: false, error: error.message });
      }

      if (
        error.code === 'REPORT_VALIDATION_ERROR' ||
        error.code === 'REPORT_VOICES_NOT_FOUND'
      ) {
        return res.status(400).json({ success: false, error: error.message });
      }

      res.status(500).json({
        success: false,
        error: error.message || 'Errore interno del server'
      });
    }
  }

  async deleteReport(req, res) {
    try {
      const result = this.reportService.delete(req.params.reportId);
      res.json(result);
    } catch (error) {
      logger.error(`Errore eliminazione report ${req.params.reportId}:`, error);

      if (error.message.includes('non trovato')) {
        return res.status(404).json({ success: false, error: error.message });
      }

      res.status(500).json({
        success: false,
        error: error.message || 'Errore interno del server'
      });
    }
  }
}

export default ReportsController;
