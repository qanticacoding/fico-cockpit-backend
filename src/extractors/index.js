/**
 * Extractor Registry - Registro estrattori disponibili
 */

import FIExtractor from './fi-extractor.js';

/**
 * Registry degli estrattori
 * Ogni estrattore deve essere registrato qui per essere usato nei job
 */
const extractorRegistry = {
  
  /**
   * Estrattore dati contabili FI
   */
  'fi_extractor': {
    class: FIExtractor,
    description: 'Estrae dati contabili (GL accounts) da SAP',
    requiredParams: ['yearFrom', 'yearTo'],
    optionalParams: [],
    outputTable: 'sap_fi_data'
  }

  // TODO: Aggiungere altri estrattori qui
  // 'co_extractor': { ... },
  // 'mm_extractor': { ... },
  
};

/**
 * Ottiene istanza estrattore per nome
 */
function getExtractor(extractorName, config = {}) {
  const extractorDef = extractorRegistry[extractorName];
  
  if (!extractorDef) {
    throw new Error(`Estrattore non trovato: ${extractorName}`);
  }

  return new extractorDef.class(config);
}

/**
 * Lista estrattori disponibili
 */
function listExtractors() {
  return Object.keys(extractorRegistry).map(name => ({
    name,
    description: extractorRegistry[name].description,
    requiredParams: extractorRegistry[name].requiredParams,
    outputTable: extractorRegistry[name].outputTable
  }));
}

export {
  extractorRegistry,
  getExtractor,
  listExtractors
};
