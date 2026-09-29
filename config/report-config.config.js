/**
 * Configurazione Report nel configuration DB.
 * I report condividono il database delle voci per poter usare foreign key reali.
 */

import voiceConfigConfig from './voice-config.config.js';

const reportConfig = {
  dbPath: voiceConfigConfig.dbPath,

  schemas: {
    reports: `
      CREATE TABLE IF NOT EXISTS reports (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        class TEXT NOT NULL,
        time_granularity TEXT NOT NULL
          CHECK(time_granularity IN ('day', 'week', 'month', 'quarter', 'year')),
        type TEXT NOT NULL
          CHECK(type IN ('table', 'bar', 'pie', 'grouped_bar')),
        sort_order INTEGER NOT NULL DEFAULT 0,
        enabled BOOLEAN NOT NULL DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `,

    reportVoices: `
      CREATE TABLE IF NOT EXISTS report_voices (
        report_id TEXT NOT NULL,
        voice_id TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,

        PRIMARY KEY (report_id, voice_id),
        FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE,
        FOREIGN KEY (voice_id) REFERENCES voices(id) ON DELETE RESTRICT
      );
    `
  },

  indexes: [
    'CREATE INDEX IF NOT EXISTS idx_reports_class ON reports(class);',
    'CREATE INDEX IF NOT EXISTS idx_reports_enabled ON reports(enabled);',
    'CREATE INDEX IF NOT EXISTS idx_reports_sort_order ON reports(sort_order);',
    'CREATE INDEX IF NOT EXISTS idx_report_voices_report ON report_voices(report_id);',
    'CREATE INDEX IF NOT EXISTS idx_report_voices_voice ON report_voices(voice_id);'
  ],

  triggers: [
    `CREATE TRIGGER IF NOT EXISTS update_reports_timestamp
     AFTER UPDATE ON reports
     FOR EACH ROW
     BEGIN
       UPDATE reports SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
     END;`
  ]
};

export default reportConfig;
