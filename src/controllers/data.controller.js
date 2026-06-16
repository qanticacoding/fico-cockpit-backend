/**
 * Data Controller
 * Logica per query dati contabili
 */

import logger from '../utils/logger.js';

class DataController {
  constructor(dbClient) {
    this.dbClient = dbClient;
  }

  /**
   * Query dati SAP FI (contabilità)
   */
  async queryFiData(req, res) {
    const { year, account } = req.query;

    if (!this.dbClient) {
      return res.status(503).json({ error: 'Database non disponibile' });
    }

    try {
      let query = 'SELECT * FROM sap_fi_data WHERE 1=1';
      const params = [];

      if (year) {
        query += ' AND fiscal_year = ?';
        params.push(parseInt(year));
      }

      if (account) {
        query += ' AND account = ?';
        params.push(account);
      }

      const result = await this.dbClient.query(query, params);
      res.json({
        count: result.length,
        data: result
      });
    } catch (error) {
      logger.error('Errore query dati FI:', error);
      res.status(500).json({ error: error.message });
    }
  }
}

export default DataController;
