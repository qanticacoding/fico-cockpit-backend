/**
 * Report Executor Service
 * Carica report JSON, esegue voci e formatta risultati
 */

import fs from 'fs/promises';
import path from 'path';
import logger from '../utils/logger.js';

class ReportExecutor {
  constructor(voiceExecutor) {
    this.voiceExecutor = voiceExecutor;
    this.reportsLibrary = null;
    this.reportsMap = new Map();
  }

  /**
   * Carica reports library da file unico
   * @param {string} filePath - Path del file config
   * @returns {Promise<boolean>}
   */
  async loadReportsLibrary(filePath = './config/reports.json') {
    try {
      this.reportsFilePath = filePath;
      const content = await fs.readFile(filePath, 'utf-8');
      this.reportsLibrary = JSON.parse(content);
      
      // Costruisci mappa veloce id -> report
      this.reportsMap.clear();
      if (this.reportsLibrary.reports && Array.isArray(this.reportsLibrary.reports)) {
        this.reportsLibrary.reports.forEach(report => {
          this.reportsMap.set(report.id, report);
        });
      }
      
      logger.info(`Reports library caricata: ${this.reportsMap.size} report`);
      return true;
    } catch (error) {
      logger.error('Errore caricamento reports library:', error);
      throw error;
    }
  }

  /**
   * Ottiene configurazione di un report
   * @param {string} reportId - ID del report
   * @returns {Object} Report config
   */
  getReport(reportId) {
    // Lazy load della library
    if (!this.reportsLibrary) {
      throw new Error('Reports library non caricata. Chiamare loadReportsLibrary() prima.');
    }
    
    const report = this.reportsMap.get(reportId);
    if (!report) {
      throw new Error(`Report non trovato: ${reportId}`);
    }
    
    logger.info(`Report caricato: ${reportId}`);
    return report;
  }

  /**
   * Esegue un report completo
   * @param {string} reportId - ID del report
   * @param {Object} params - Parametri esecuzione (fiscal_year, period_from, period_to)
   * @returns {Promise<Object>} Report formattato con risultati
   */
  async executeReport(reportId, params) {
    const startTime = Date.now();
    
    try {
      // 1. Ottieni configurazione report dalla library
      logger.info(`\n=== Report Executor: Avvio esecuzione ===`);
      logger.info(`Report ID: ${reportId}`);
      logger.info(`Parametri: anno=${params.fiscal_year}, periodi=${params.period_from}-${params.period_to}`);
      
      const report = this.getReport(reportId);
      
      // 2. Valida report
      if (!report.voices_used || !Array.isArray(report.voices_used)) {
        throw new Error('Report invalido: manca array voices_used');
      }
      
      if (report.voices_used.length === 0) {
        throw new Error('Report invalido: voices_used è vuoto');
      }
      
      logger.info(`Voci richieste dal report: ${report.voices_used.join(', ')}`);
      
      // 3. Esegui tutte le voci richieste dal report
      const voiceResults = await this.voiceExecutor.executeVoices(
        report.voices_used,
        params
      );
      
      if (!voiceResults.success) {
        throw new Error('Errore esecuzione voci del report');
      }
      
      logger.info(`Voci calcolate: ${Object.keys(voiceResults.results).length}`);
      
      // 4. Formatta risultati secondo layout report
      const formattedReport = this._formatReport(report, voiceResults, params);
      
      const executionTime = Date.now() - startTime;
      
      logger.info(`\n=== Report Executor: Completato in ${executionTime}ms ===`);
      
      return {
        success: true,
        report_id: reportId,
        report_name: report.name || reportId,
        params: params,
        data: formattedReport,
        execution_time: executionTime,
        voices_calculated: Object.keys(voiceResults.results).length,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      logger.error(`Errore esecuzione report ${reportId}:`, error);
      throw error;
    }
  }

  /**
   * Formatta risultati secondo layout report
   * @private
   */
  _formatReport(report, voiceResults, params) {
    const layout = report.layout || { format: 'simple', sections: [] };
    
    if (layout.format === 'simple') {
      return this._formatSimpleReport(report, voiceResults, params);
    } else if (layout.format === 'detailed') {
      return this._formatDetailedReport(report, voiceResults, params);
    } else {
      // Default: ritorna solo i risultati grezzi
      return voiceResults.results;
    }
  }

  /**
   * Formato semplice: lista sezioni con voci
   * @private
   */
  _formatSimpleReport(report, voiceResults, params) {
    const sections = report.layout?.sections || [];
    
    return {
      metadata: {
        report_name: report.name || 'Report',
        description: report.description || '',
        fiscal_year: params.fiscal_year,
        period_from: params.period_from,
        period_to: params.period_to,
        generated_at: new Date().toISOString()
      },
      sections: sections.map(section => ({
        title: section.title,
        voices: section.voices.map(voiceConfig => {
          const voiceId = voiceConfig.voice_id;
          const value = voiceResults.results[voiceId];
          
          return {
            label: voiceConfig.label || voiceId,
            voice_id: voiceId,
            value: value,
            format: voiceConfig.format || 'number',
            formatted_value: this._formatValue(value, voiceConfig.format || 'number')
          };
        })
      }))
    };
  }

  /**
   * Formato dettagliato: include metadata, breakdown, ecc.
   * @private
   */
  _formatDetailedReport(report, voiceResults, params) {
    // TODO: implementare formato dettagliato con breakdown per periodo, drill-down, ecc.
    return this._formatSimpleReport(report, voiceResults, params);
  }

  /**
   * Formatta valore secondo tipo
   * @private
   */
  _formatValue(value, format) {
    if (value === null || value === undefined) {
      return 'N/A';
    }
    
    switch (format) {
      case 'currency':
        return new Intl.NumberFormat('it-IT', {
          style: 'currency',
          currency: 'EUR',
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        }).format(value);
      
      case 'percentage':
        return new Intl.NumberFormat('it-IT', {
          style: 'percent',
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        }).format(value / 100);
      
      case 'number':
        return new Intl.NumberFormat('it-IT', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        }).format(value);
      
      default:
        return value.toString();
    }
  }

  /**
   * Lista tutti i report disponibili
   * @returns {Array} Lista report
   */
  listReports() {
    if (!this.reportsLibrary) {
      throw new Error('Reports library non caricata. Chiamare loadReportsLibrary() prima.');
    }
    
    return this.reportsLibrary.reports.map(report => ({
      id: report.id,
      name: report.name || report.id,
      description: report.description || '',
      voices_count: report.voices_used?.length || 0,
      owner: report.owner || ''
    }));
  }

  /**
   * Dettaglio configurazione report
   * @param {string} reportId - ID del report
   * @returns {Object} Report config completo
   */
  getReportConfig(reportId) {
    return this.getReport(reportId);
  }

  /**
   * Salva la library su disco
   * @private
   */
  async _saveReportsLibrary() {
    const content = JSON.stringify(this.reportsLibrary, null, 2);
    await fs.writeFile(this.reportsFilePath, content, 'utf-8');
    logger.info('Reports library salvata su disco');
  }

  /**
   * Crea un nuovo report
   * @param {Object} reportConfig - Configurazione del nuovo report
   * @returns {Object} Report creato
   */
  async createReport(reportConfig) {
    if (!this.reportsLibrary) {
      throw new Error('Reports library non caricata.');
    }

    const { id } = reportConfig;
    if (!id) {
      throw new Error('Campo obbligatorio mancante: id');
    }
    if (this.reportsMap.has(id)) {
      throw new Error(`Report già esistente con id: ${id}`);
    }

    this.reportsLibrary.reports.push(reportConfig);
    this.reportsMap.set(id, reportConfig);
    this.reportsLibrary.reports_library.last_updated = new Date().toISOString().split('T')[0];

    await this._saveReportsLibrary();
    logger.info(`Report creato: ${id}`);
    return reportConfig;
  }

  /**
   * Aggiorna un report esistente (merge parziale)
   * @param {string} reportId - ID del report da aggiornare
   * @param {Object} updates - Campi da aggiornare
   * @returns {Object} Report aggiornato
   */
  async updateReport(reportId, updates) {
    if (!this.reportsLibrary) {
      throw new Error('Reports library non caricata.');
    }

    const existing = this.reportsMap.get(reportId);
    if (!existing) {
      throw new Error(`Report non trovato: ${reportId}`);
    }

    // L'id non può essere modificato tramite update
    const { id: _ignored, ...safeUpdates } = updates;

    const updated = { ...existing, ...safeUpdates };

    const idx = this.reportsLibrary.reports.findIndex(r => r.id === reportId);
    this.reportsLibrary.reports[idx] = updated;
    this.reportsMap.set(reportId, updated);
    this.reportsLibrary.reports_library.last_updated = new Date().toISOString().split('T')[0];

    await this._saveReportsLibrary();
    logger.info(`Report aggiornato: ${reportId}`);
    return updated;
  }

  /**
   * Elimina un report
   * @param {string} reportId - ID del report da eliminare
   */
  async deleteReport(reportId) {
    if (!this.reportsLibrary) {
      throw new Error('Reports library non caricata.');
    }

    if (!this.reportsMap.has(reportId)) {
      throw new Error(`Report non trovato: ${reportId}`);
    }

    this.reportsLibrary.reports = this.reportsLibrary.reports.filter(r => r.id !== reportId);
    this.reportsMap.delete(reportId);
    this.reportsLibrary.reports_library.last_updated = new Date().toISOString().split('T')[0];

    await this._saveReportsLibrary();
    logger.info(`Report eliminato: ${reportId}`);
  }
}

export default ReportExecutor;
