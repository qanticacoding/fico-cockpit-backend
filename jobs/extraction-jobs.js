/**
 * Extraction Jobs - Definizioni job di estrazione
 */

const jobs = [
  {
    id: 'fi_monthly_extraction',
    name: 'Estrazione Contabilità Mensile',
    description: 'Estrae dati contabili FI dal mese precedente',
    
    // Schedule: Ogni 1° del mese alle 02:00
    schedule: '0 2 1 * *',
    
    // Estrattori da eseguire (sequenziale)
    extractors: [
      {
        name: 'fi_extractor',
        targetTable: 'sap_fi_data',
        params: {
          yearFrom: 2025,  // TODO: rendere dinamico (anno corrente)
          yearTo: 2025
        }
      }
    ],
    
    // Configurazioni
    enabled: true,
    retryOnError: 3,
    timeout: 3600000  // 1 ora
  },

  // TODO: Aggiungere altri job
  
  // {
  //   id: 'fi_full_year',
  //   name: 'Estrazione Contabilità Anno Completo',
  //   schedule: '0 3 1 1 *',  // 1° Gennaio alle 03:00
  //   extractors: [
  //     {
  //       name: 'fi_extractor',
  //       targetTable: 'sap_fi_data',
  //       params: {
  //         yearFrom: new Date().getFullYear() - 1,
  //         yearTo: new Date().getFullYear() - 1
  //       }
  //     }
  //   ],
  //   enabled: false,
  //   retryOnError: 3,
  //   timeout: 7200000  // 2 ore
  // }

];

export default jobs;
