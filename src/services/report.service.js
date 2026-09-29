/**
 * Report Service
 * Regole applicative per la definizione dei report.
 * Non esegue report e non calcola voci.
 */

import ReportRepository from '../repositories/report.repository.js';
import VoiceConfigClient from '../storage/voice-config-client.js';
import validateReport from '../domain/reports/report.validator.js';

class ReportService {
  constructor({
    reportRepository = new ReportRepository(),
    voiceConfigClient = new VoiceConfigClient()
  } = {}) {
    this.reportRepository = reportRepository;
    this.voiceConfigClient = voiceConfigClient;
  }

  list(filters = {}) {
    return this.reportRepository.list(filters);
  }

  getById(id) {
    const report = this.reportRepository.getById(id);
    if (!report) {
      throw new Error(`Report non trovato: ${id}`);
    }
    return report;
  }

  create(report) {
    this.validate(report, { requireId: true });

    if (this.reportRepository.getById(report.id)) {
      throw new Error(`Report già esistente: ${report.id}`);
    }

    this.validateVoices(report.voices);
    return this.reportRepository.create(report);
  }

  update(id, report) {
    this.getById(id);

    const canonicalReport = {
      ...report,
      id
    };

    this.validate(canonicalReport, { requireId: true });
    this.validateVoices(canonicalReport.voices);

    return this.reportRepository.update(id, canonicalReport);
  }

  delete(id) {
    this.getById(id);
    this.reportRepository.delete(id);
    return { success: true, report_id: id };
  }

  validate(report, options) {
    const validation = validateReport(report, options);
    if (!validation.valid) {
      const error = new Error(validation.errors.join('; '));
      error.code = 'REPORT_VALIDATION_ERROR';
      throw error;
    }
  }

  validateVoices(voiceIds) {
    const missing = voiceIds.filter(
      voiceId => !this.voiceConfigClient.getVoiceById(voiceId)
    );

    if (missing.length > 0) {
      const error = new Error(`Voci non trovate: ${missing.join(', ')}`);
      error.code = 'REPORT_VOICES_NOT_FOUND';
      throw error;
    }
  }
}

export default ReportService;
