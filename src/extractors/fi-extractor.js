/**
 * FI Extractor - Estrattore dati contabili SAP
 */

import axios from 'axios';
import BaseExtractor from './base-extractor.js';
import sapConfig from '../../config/sap.config.js';
import { validateSapResponse } from '../processors/validator.js';

class FIExtractor extends BaseExtractor {
  constructor(config) {
    super(config);
    this.name = 'FIExtractor';
  }

  /**
   * Valida parametri estrattore
   */
  validateParams(params) {
    if (!params.yearFrom || !params.yearTo) {
      throw new Error('Parametri obbligatori: yearFrom, yearTo');
    }

    if (params.yearFrom > params.yearTo) {
      throw new Error('yearFrom non può essere maggiore di yearTo');
    }

    return true;
  }

  /**
   * Estrae dati contabili da SAP
   */
  async extract(params) {
    const { yearFrom, yearTo } = params;
    
    this.log('info', `Estrazione dati FI: anno ${yearFrom} - ${yearTo}`);

    try {
      // Costruisce URL con parametri
      const url = sapConfig.buildUrl({
        yearfrom: yearFrom,
        yearto: yearTo
      });

      this.log('debug', `Chiamata API: ${url}`);

      // Esegue chiamata HTTP
      const response = await axios.get(url, {
        headers: sapConfig.getHeaders(),
        timeout: sapConfig.timeout
      });

      // Valida response
      validateSapResponse(response.data);

      this.log('info', `Ricevuti ${response.data.length} record da SAP`);
      
      return response.data;

    } catch (error) {
      if (error.response) {
        // Errore HTTP
        this.log('error', `Errore HTTP ${error.response.status}`, {
          status: error.response.status,
          data: error.response.data
        });
        throw new Error(`Errore SAP API: ${error.response.status} - ${error.response.statusText}`);
      } else if (error.request) {
        // Nessuna response
        this.log('error', 'Nessuna risposta da SAP', { error: error.message });
        throw new Error('SAP non raggiungibile: timeout o connessione fallita');
      } else {
        // Altro errore
        throw error;
      }
    }
  }

  /**
   * Post-processing: filtra record invalidi
   */
  async afterExtract(data, params) {
    // Filtra record senza anno o conto
    const filtered = data.filter(record => {
      if (!record.ryear || !record.racct) {
        this.log('warn', 'Record senza ryear o racct, saltato', record);
        return false;
      }
      return true;
    });

    if (filtered.length < data.length) {
      this.log('warn', `Filtrati ${data.length - filtered.length} record invalidi`);
    }

    return filtered;
  }
}

export default FIExtractor;
