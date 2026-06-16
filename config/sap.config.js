/**
 * Configurazione connessione SAP
 */

const sapConfig = {
  baseUrl: process.env.SAP_BASE_URL || 'http://sapr3prd.beltramesrl.local:8030',
  
  // API per dati contabili
  fiDataApi: {
    path: process.env.SAP_API_PATH || '/sap/bc/zfidata',
    timeout: parseInt(process.env.SAP_TIMEOUT) || 30000,
  },
  
  // API per Set SAP (raggruppamenti conti/CDC)
  setApi: {
    path: process.env.SAP_SET_API_PATH || '/sap/bc/ybreakeven/yset',
    timeout: parseInt(process.env.SAP_SET_TIMEOUT) || 15000,
  },
  
  /**
   * Costruisce URL completo per API dati contabili
   */
  buildUrl(params = {}) {
    const url = new URL(this.fiDataApi.path, this.baseUrl);
    Object.keys(params).forEach(key => {
      url.searchParams.append(key, params[key]);
    });
    return url.toString();
  },
  
  /**
   * Costruisce URL completo per API Set SAP
   * @param {string} setclass - Classe del set (es: '0109')
   * @param {string} setname - Nome del set (es: 'SG_A')
   */
  buildSetUrl(setclass, setname) {
    const url = new URL(this.setApi.path, this.baseUrl);
    url.searchParams.append('setclass', setclass);
    url.searchParams.append('setname', setname);
    return url.toString();
  },
  
  /**
   * Headers di default per richieste
   */
  getHeaders() {
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
  }
};

export default sapConfig;
