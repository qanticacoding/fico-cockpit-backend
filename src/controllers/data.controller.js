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
    const {
			year,
			period,
			account,
			costCenter,
			limit = 100,
			offset = 0,
		} = req.query;

		if (!this.dbClient) {
			return res.status(503).json({ error: "Database non disponibile" });
		}

		try {
			// Query per contare i record totali
			let countQuery = "SELECT COUNT(*) as total FROM sap_fi_data WHERE 1=1";
			const countParams = [];

			// Query per i dati
			let query = "SELECT * FROM sap_fi_data WHERE 1=1";
			const params = [];

			// Applica filtri
			if (year) {
				const yearFilter = " AND fiscal_year = ?";
				query += yearFilter;
				countQuery += yearFilter;
				const yearValue = parseInt(year);
				params.push(yearValue);
				countParams.push(yearValue);
			}

			if (period) {
				const periodFilter = " AND fiscal_period = ?";
				query += periodFilter;
				countQuery += periodFilter;
				const periodValue = parseInt(period);
				params.push(periodValue);
				countParams.push(periodValue);
			}

			if (account) {
				const accountFilter = " AND account = ?";
				query += accountFilter;
				countQuery += accountFilter;
				params.push(account);
				countParams.push(account);
			}

			if (costCenter) {
				const costCenterFilter = " AND cost_center = ?";
				query += costCenterFilter;
				countQuery += costCenterFilter;
				params.push(costCenter);
				countParams.push(costCenter);
			}

			// Ottieni il totale dei record
			const countResult = await this.dbClient.query(countQuery, countParams);
			const total = countResult[0]?.total || 0;

			// Applica paginazione
			const limitValue = Math.min(parseInt(limit), 10000); // Max 10000
			const offsetValue = parseInt(offset) || 0;

			query += " ORDER BY fiscal_year DESC, fiscal_period DESC, account";
			query += " LIMIT ? OFFSET ?";
			params.push(limitValue, offsetValue);

			// Esegui query
			const result = await this.dbClient.query(query, params);

			res.json({
				count: result.length,
				data: result,
				pagination: {
					limit: limitValue,
					offset: offsetValue,
					total: total,
				},
			});
		} catch (error) {
			logger.error("Errore query dati FI:", error);
			res.status(500).json({ error: error.message });
		}
  }
}

export default DataController;
