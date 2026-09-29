/**
 * Report Repository
 * Persistenza delle definizioni report nel configuration DB SQLite.
 */

import Database from 'better-sqlite3';
import reportConfig from '../../config/report-config.config.js';
import logger from '../utils/logger.js';

class ReportRepository {
  constructor() {
    this.db = null;
  }

  connect() {
    if (!this.db) {
      this.db = new Database(reportConfig.dbPath);
      this.db.pragma('foreign_keys = ON');
      this.ensureSchema();
      logger.info(`Report Repository connesso: ${reportConfig.dbPath}`);
    }

    return this.db;
  }

  ensureSchema() {
    this.db.exec(reportConfig.schemas.reports);
    this.db.exec(reportConfig.schemas.reportVoices);
    reportConfig.indexes.forEach(sql => this.db.exec(sql));
    reportConfig.triggers.forEach(sql => this.db.exec(sql));
  }

  disconnect() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  list({ reportClass, enabled } = {}) {
    this.connect();

    let sql = 'SELECT * FROM reports WHERE 1=1';
    const params = [];

    if (reportClass) {
      sql += ' AND class = ?';
      params.push(reportClass);
    }

    if (typeof enabled === 'boolean') {
      sql += ' AND enabled = ?';
      params.push(enabled ? 1 : 0);
    }

    sql += ' ORDER BY class, sort_order, name';

    return this.db.prepare(sql).all(...params).map(row => this.toDomain(row));
  }

  getById(id) {
    this.connect();
    const row = this.db.prepare('SELECT * FROM reports WHERE id = ?').get(id);
    return row ? this.toDomain(row) : null;
  }

  create(report) {
    this.connect();

    const insertReport = this.db.prepare(`
      INSERT INTO reports (
        id, name, description, class, time_granularity, type, sort_order, enabled
      ) VALUES (
        @id, @name, @description, @class, @time_granularity, @type, @sort_order, @enabled
      )
    `);

    const insertVoice = this.db.prepare(`
      INSERT INTO report_voices (report_id, voice_id, sort_order)
      VALUES (?, ?, ?)
    `);

    const transaction = this.db.transaction(() => {
      insertReport.run({
        id: report.id,
        name: report.name,
        description: report.description,
        class: report.class,
        time_granularity: report.time_granularity,
        type: report.type,
        sort_order: report.sort_order ?? 0,
        enabled: report.enabled === false ? 0 : 1
      });

      report.voices.forEach((voiceId, index) => {
        insertVoice.run(report.id, voiceId, index);
      });
    });

    transaction();
    return this.getById(report.id);
  }

  update(id, report) {
    this.connect();

    const updateReport = this.db.prepare(`
      UPDATE reports SET
        name = @name,
        description = @description,
        class = @class,
        time_granularity = @time_granularity,
        type = @type,
        sort_order = @sort_order,
        enabled = @enabled
      WHERE id = @id
    `);

    const deleteVoices = this.db.prepare(
      'DELETE FROM report_voices WHERE report_id = ?'
    );

    const insertVoice = this.db.prepare(`
      INSERT INTO report_voices (report_id, voice_id, sort_order)
      VALUES (?, ?, ?)
    `);

    const transaction = this.db.transaction(() => {
      updateReport.run({
        id,
        name: report.name,
        description: report.description,
        class: report.class,
        time_granularity: report.time_granularity,
        type: report.type,
        sort_order: report.sort_order ?? 0,
        enabled: report.enabled === false ? 0 : 1
      });

      deleteVoices.run(id);
      report.voices.forEach((voiceId, index) => {
        insertVoice.run(id, voiceId, index);
      });
    });

    transaction();
    return this.getById(id);
  }

  delete(id) {
    this.connect();
    return this.db.prepare('DELETE FROM reports WHERE id = ?').run(id);
  }

  getVoices(reportId) {
    this.connect();
    return this.db.prepare(`
      SELECT voice_id
      FROM report_voices
      WHERE report_id = ?
      ORDER BY sort_order, voice_id
    `).all(reportId).map(row => row.voice_id);
  }

  getReportsUsingVoice(voiceId) {
    this.connect();
    return this.db.prepare(`
      SELECT report_id
      FROM report_voices
      WHERE voice_id = ?
      ORDER BY report_id
    `).all(voiceId).map(row => row.report_id);
  }

  toDomain(row) {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      class: row.class,
      voices: this.getVoices(row.id),
      time_granularity: row.time_granularity,
      type: row.type,
      sort_order: row.sort_order,
      enabled: Boolean(row.enabled)
    };
  }
}

export default ReportRepository;
