/**
 * Reports Controller
 * Gestisce richieste HTTP per esecuzione report
 */

import logger from '../utils/logger.js';

class ReportsController {
  constructor(reportExecutor) {
    this.reportExecutor = reportExecutor;
  }

  /**
   * POST /api/reports/execute
   * Esegue un report completo
   */
  async executeReport(req, res) {
    try {
      const { report_id, fiscal_year, period_from, period_to } = req.body;

      // Validazione input
      if (!report_id) {
        return res.status(400).json({
          success: false,
          error: 'Parametro obbligatorio mancante: report_id'
        });
      }

      if (!fiscal_year) {
        return res.status(400).json({
          success: false,
          error: 'Parametro obbligatorio mancante: fiscal_year'
        });
      }

      // Validazione anno fiscale
      if (typeof fiscal_year !== 'number' || fiscal_year < 2000 || fiscal_year > 2100) {
        return res.status(400).json({
          success: false,
          error: 'fiscal_year deve essere un numero tra 2000 e 2100'
        });
      }

      // Default periodi: 1-12 (tutto l'anno)
      const periodFrom = period_from !== undefined ? period_from : 1;
      const periodTo = period_to !== undefined ? period_to : 12;

      // Validazione periodi (0-12: 0=saldo iniziale, 1-12=mesi)
      if (periodFrom < 0 || periodFrom > 12 || periodTo < 0 || periodTo > 12) {
        return res.status(400).json({
          success: false,
          error: 'period_from e period_to devono essere tra 0 e 12'
        });
      }

      if (periodFrom > periodTo) {
        return res.status(400).json({
          success: false,
          error: 'period_from non può essere maggiore di period_to'
        });
      }

      logger.info(`Richiesta esecuzione report: ${report_id}`);

      // Esegui report
      const result = await this.reportExecutor.executeReport(report_id, {
        fiscal_year,
        period_from: periodFrom,
        period_to: periodTo
      });

      res.json(result);

    } catch (error) {
      logger.error('Errore esecuzione report:', error);
      
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

  /**
   * GET /api/reports
   * Lista tutti i report disponibili
   */
  async listReports(req, res) {
    try {
      const reports = this.reportExecutor.listReports();

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

  /**
   * GET /api/reports/:reportId
   * Ottiene configurazione di un report specifico
   */
  async getReport(req, res) {
    try {
      const { reportId } = req.params;

      const config = this.reportExecutor.getReportConfig(reportId);

      res.json({
        success: true,
        report: config
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
}

export default ReportsController;
