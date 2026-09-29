/**
 * Report domain validator
 */

import { REPORT_TYPES, TIME_GRANULARITIES } from './report.constants.js';

function validateReport(report, { requireId = true } = {}) {
  const errors = [];

  if (!report || typeof report !== 'object' || Array.isArray(report)) {
    return { valid: false, errors: ['Report non valido'] };
  }

  if (requireId && (!report.id || typeof report.id !== 'string')) {
    errors.push('id è obbligatorio');
  }

  if (!report.name || typeof report.name !== 'string') {
    errors.push('name è obbligatorio');
  }

  if (!report.description || typeof report.description !== 'string') {
    errors.push('description è obbligatoria');
  }

  if (!report.class || typeof report.class !== 'string') {
    errors.push('class è obbligatoria');
  }

  if (!Array.isArray(report.voices) || report.voices.length === 0) {
    errors.push('voices deve contenere almeno una voce');
  } else {
    const invalidVoices = report.voices.filter(
      voiceId => !voiceId || typeof voiceId !== 'string'
    );
    if (invalidVoices.length > 0) {
      errors.push('voices deve contenere solo ID voce validi');
    }

    if (new Set(report.voices).size !== report.voices.length) {
      errors.push('voices non può contenere duplicati');
    }
  }

  if (!TIME_GRANULARITIES.includes(report.time_granularity)) {
    errors.push(`time_granularity deve essere uno tra: ${TIME_GRANULARITIES.join(', ')}`);
  }

  if (!REPORT_TYPES.includes(report.type)) {
    errors.push(`type deve essere uno tra: ${REPORT_TYPES.join(', ')}`);
  }

  if (
    report.sort_order !== undefined &&
    (!Number.isInteger(report.sort_order) || report.sort_order < 0)
  ) {
    errors.push('sort_order deve essere un intero >= 0');
  }

  if (report.enabled !== undefined && typeof report.enabled !== 'boolean') {
    errors.push('enabled deve essere boolean');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export default validateReport;
