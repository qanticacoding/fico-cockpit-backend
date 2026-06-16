/**
 * Voice Executor Service
 * Esegue voci dalla voice library con gestione dipendenze
 */

import logger from '../utils/logger.js';
import VoiceConfigClient from '../storage/voice-config-client.js';

class VoiceExecutor {
  constructor(dbClient, setClient) {
    this.dbClient = dbClient;
    this.setClient = setClient;
    this.voiceConfigClient = new VoiceConfigClient();
    this.voiceLibrary = null;
    this.voicesMap = new Map();
  }

  /**
   * Carica voice library da database SQLite
   */
  async loadVoiceLibrary() {
    try {
      // Leggi voci da DB invece che da JSON
      const voices = this.voiceConfigClient.getVoicesWithDependencies();
      
      // Costruisci mappa veloce id -> voice
      this.voicesMap.clear();
      voices.forEach(voice => {
        this.voicesMap.set(voice.id, voice);
      });
      
      // Mantieni struttura voiceLibrary per compatibilità
      this.voiceLibrary = {
        voices: voices
      };
      
      logger.info(`Voice library caricata da DB: ${this.voicesMap.size} voci`);
      return true;
    } catch (error) {
      logger.error('Errore caricamento voice library da DB:', error);
      throw error;
    }
  }

  /**
   * Ricarica voice library da DB (per refresh dopo modifiche)
   */
  async reloadVoiceLibrary() {
    logger.info('Ricaricamento voice library...');
    return await this.loadVoiceLibrary();
  }

  /**
   * Ottieni definizione voce per ID
   */
  getVoice(voiceId) {
    if (!this.voicesMap.has(voiceId)) {
      throw new Error(`Voce non trovata: ${voiceId}`);
    }
    return this.voicesMap.get(voiceId);
  }

  /**
   * Costruisce grafo dipendenze per voci CALCULATED
   */
  buildDependencyGraph(voiceIds) {
    const graph = new Map();
    const visited = new Set();
    
    const visit = (voiceId) => {
      if (visited.has(voiceId)) return;
      visited.add(voiceId);
      
      const voice = this.getVoice(voiceId);
      graph.set(voiceId, {
        voice,
        dependencies: voice.dependencies || []
      });
      
      // Visita ricorsivamente le dipendenze
      if (voice.dependencies) {
        voice.dependencies.forEach(depId => visit(depId));
      }
    };
    
    voiceIds.forEach(id => visit(id));
    return graph;
  }

  /**
   * Topological sort per ordine esecuzione
   */
  topologicalSort(graph) {
    const sorted = [];
    const visited = new Set();
    const visiting = new Set();
    
    const visit = (voiceId) => {
      if (visited.has(voiceId)) return;
      if (visiting.has(voiceId)) {
        throw new Error(`Dipendenza circolare rilevata per: ${voiceId}`);
      }
      
      visiting.add(voiceId);
      const node = graph.get(voiceId);
      
      // Visita prima le dipendenze
      if (node.dependencies) {
        node.dependencies.forEach(depId => visit(depId));
      }
      
      visiting.delete(voiceId);
      visited.add(voiceId);
      sorted.push(voiceId);
    };
    
    Array.from(graph.keys()).forEach(id => visit(id));
    return sorted;
  }

  /**
   * Esegue voce BASE_A: somma conti senza filtro CDC
   */
  async executeBaseA(voice, params) {
    const { fiscal_year, period_from = 1, period_to = 12 } = params;
    
    logger.info(`[BASE_A] Esecuzione voce: ${voice.id}`);
    
    // Ottieni set conti da SAP
    const { setclass, setname } = voice.account_set;
    const setData = await this.setClient.fetchSet(setclass, setname);
    
    if (!setData.members || setData.members.length === 0) {
      logger.warn(`Set ${setclass}/${setname} vuoto o non trovato`);
      return 0;
    }
    
    const accounts = setData.members.map(m => m.keyid);
    logger.info(`[BASE_A] Set ${setname}: ${accounts.length} conti`);
    
    // Query database per tutti i conti
    const placeholders = accounts.map(() => '?').join(',');
    const query = `
      SELECT SUM(amount) as total
      FROM sap_fi_data
      WHERE fiscal_year = ?
        AND account IN (${placeholders})
        AND fiscal_period BETWEEN ? AND ?
    `;
    
    const queryParams = [fiscal_year, ...accounts, period_from, period_to];
    const result = await this.dbClient.queryOne(query, queryParams);
    
    const total = result?.total || 0;
    const signedTotal = total * (voice.sign || 1);
    
    logger.info(`[BASE_A] ${voice.id}: ${signedTotal.toFixed(2)}`);
    return signedTotal;
  }

  /**
   * Esegue voce BASE_B: somma conti CON filtro CDC
   */
  async executeBaseB(voice, params) {
    const { fiscal_year, period_from = 1, period_to = 12 } = params;
    
    logger.info(`[BASE_B] Esecuzione voce: ${voice.id}`);
    
    // Ottieni set conti
    const { setclass: accountSetClass, setname: accountSetName } = voice.account_set;
    const accountSet = await this.setClient.fetchSet(accountSetClass, accountSetName);
    
    if (!accountSet.members || accountSet.members.length === 0) {
      logger.warn(`Set conti ${accountSetClass}/${accountSetName} vuoto`);
      return 0;
    }
    
    // Ottieni set CDC
    const { setclass: cdcSetClass, setname: cdcSetName } = voice.cost_center_set;
    const cdcSet = await this.setClient.fetchSet(cdcSetClass, cdcSetName);
    
    if (!cdcSet.members || cdcSet.members.length === 0) {
      logger.warn(`Set CDC ${cdcSetClass}/${cdcSetName} vuoto`);
      return 0;
    }
    
    const accounts = accountSet.members.map(m => m.keyid);
    const costCenters = cdcSet.members.map(m => m.keyid);
    
    logger.info(`[BASE_B] Set ${accountSetName}: ${accounts.length} conti`);
    logger.info(`[BASE_B] Set ${cdcSetName}: ${costCenters.length} CDC`);
    
    // Query database con filtro CDC
    const accountPlaceholders = accounts.map(() => '?').join(',');
    const cdcPlaceholders = costCenters.map(() => '?').join(',');
    
    const query = `
      SELECT SUM(amount) as total
      FROM sap_fi_data
      WHERE fiscal_year = ?
        AND account IN (${accountPlaceholders})
        AND cost_center IN (${cdcPlaceholders})
        AND fiscal_period BETWEEN ? AND ?
    `;
    
    const queryParams = [
      fiscal_year,
      ...accounts,
      ...costCenters,
      period_from,
      period_to
    ];
    
    const result = await this.dbClient.queryOne(query, queryParams);
    
    const total = result?.total || 0;
    const signedTotal = total * (voice.sign || 1);
    
    logger.info(`[BASE_B] ${voice.id}: ${signedTotal.toFixed(2)}`);
    return signedTotal;
  }

  /**
   * Esegue voce CALCULATED: formula con dipendenze
   */
  async executeCalculated(voice, results) {
    logger.info(`[CALCULATED] Esecuzione voce: ${voice.id}`);
    
    // Valuta formula sostituendo variabili con valori
    let formula = voice.formula;
    
    voice.dependencies.forEach(depId => {
      if (!results.has(depId)) {
        throw new Error(`Dipendenza ${depId} non calcolata per ${voice.id}`);
      }
      const value = results.get(depId);
      // Sostituisci tutte le occorrenze dell'ID con il valore
      formula = formula.replace(new RegExp(`\\b${depId}\\b`, 'g'), value);
    });
    
    logger.info(`[CALCULATED] Formula originale: ${voice.formula}`);
    logger.info(`[CALCULATED] Formula risolta: ${formula}`);
    
    // Valuta espressione matematica
    try {
      // eslint-disable-next-line no-eval
      const result = eval(formula);
      logger.info(`[CALCULATED] ${voice.id}: ${result.toFixed(2)}`);
      return result;
    } catch (error) {
      logger.error(`Errore valutazione formula per ${voice.id}:`, error);
      throw new Error(`Formula non valida per ${voice.id}: ${formula}`);
    }
  }

  /**
   * Esegue singola voce in base al tipo
   */
  async executeSingleVoice(voice, params, results) {
    switch (voice.type) {
      case 'BASE_A':
        return await this.executeBaseA(voice, params);
      
      case 'BASE_B':
        return await this.executeBaseB(voice, params);
      
      case 'CALCULATED':
        return await this.executeCalculated(voice, results);
      
      default:
        throw new Error(`Tipo voce non supportato: ${voice.type}`);
    }
  }

  /**
   * Esegue lista di voci con gestione dipendenze
   */
  async executeVoices(voiceIds, params) {
    const startTime = Date.now();
    
    // Carica voice library se non già caricata
    if (!this.voiceLibrary) {
      await this.loadVoiceLibrary();
    }
    
    logger.info(`\n=== Voice Executor: Avvio esecuzione ===`);
    logger.info(`Voci richieste: ${voiceIds.join(', ')}`);
    logger.info(`Parametri: anno=${params.fiscal_year}, periodi=${params.period_from}-${params.period_to}`);
    
    // Costruisci grafo dipendenze
    const graph = this.buildDependencyGraph(voiceIds);
    logger.info(`Grafo dipendenze: ${graph.size} voci totali (con dipendenze)`);
    
    // Ordina per dipendenze (topological sort)
    const executionOrder = this.topologicalSort(graph);
    logger.info(`Ordine esecuzione: ${executionOrder.join(' → ')}`);
    
    // Esegui voci in ordine
    const results = new Map();
    
    for (const voiceId of executionOrder) {
      const node = graph.get(voiceId);
      const value = await this.executeSingleVoice(node.voice, params, results);
      results.set(voiceId, value);
    }
    
    // Filtra risultati solo per voci richieste
    const requestedResults = {};
    voiceIds.forEach(id => {
      requestedResults[id] = results.get(id);
    });
    
    const duration = Date.now() - startTime;
    logger.info(`\n=== Voice Executor: Completato in ${duration}ms ===`);
    
    return {
      success: true,
      results: requestedResults,
      execution_time: duration,
      voices_executed: executionOrder.length,
      timestamp: new Date().toISOString()
    };
  }
}

export default VoiceExecutor;
