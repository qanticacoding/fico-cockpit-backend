/**
 * Script di estrazione dati SAP con anno parametrizzato
 * 
 * Esegui con:
 *   node scripts/extract-sap-data.js --year 2024
 *   node scripts/extract-sap-data.js --yearFrom 2023 --yearTo 2024
 *   node scripts/extract-sap-data.js (default: anno corrente)
 * 
 * Esempi:
 *   npm run extract-sap -- --year 2024
 *   npm run extract-sap -- --yearFrom 2023 --yearTo 2025
 */

import 'dotenv/config';
import SQLiteClient from '../src/storage/sqlite-client.js';
import { getExtractor } from '../src/extractors/index.js';
import { transformSapFiData, validateBatch } from '../src/processors/transformer.js';
import logger from '../src/utils/logger.js';
import { retryWithBackoff } from '../src/utils/error-handler.js';

// Parse parametri da linea di comando
function parseArgs() {
  const args = process.argv.slice(2);
  const params = {
    yearFrom: null,
    yearTo: null
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--year' && i + 1 < args.length) {
      params.yearFrom = parseInt(args[i + 1]);
      params.yearTo = parseInt(args[i + 1]);
      i++;
    } else if (args[i] === '--yearFrom' && i + 1 < args.length) {
      params.yearFrom = parseInt(args[i + 1]);
      i++;
    } else if (args[i] === '--yearTo' && i + 1 < args.length) {
      params.yearTo = parseInt(args[i + 1]);
      i++;
    }
  }

  // Default: anno corrente
  if (!params.yearFrom) {
    const currentYear = new Date().getFullYear();
    params.yearFrom = currentYear;
    params.yearTo = currentYear;
  }
  
  // Se solo yearFrom specificato, usa stesso valore per yearTo
  if (params.yearFrom && !params.yearTo) {
    params.yearTo = params.yearFrom;
  }

  return params;
}

/**
 * Estrae e importa dati SAP FI
 */
async function extractAndImportData() {
  const startTime = Date.now();
  let dbClient;

  try {
    // Parse parametri
    const params = parseArgs();
    
    logger.info('\n' + '='.repeat(70));
    logger.info('🚀 SAP FI Data Extraction Script');
    logger.info('='.repeat(70));
    logger.info(`📅 Anno: ${params.yearFrom}${params.yearFrom !== params.yearTo ? ' - ' + params.yearTo : ''}`);
    logger.info('='.repeat(70) + '\n');

    // Validazione anni
    if (params.yearFrom > params.yearTo) {
      throw new Error('yearFrom non può essere maggiore di yearTo');
    }

    if (params.yearFrom < 2000 || params.yearTo > 2100) {
      throw new Error('Anno non valido (range: 2000-2100)');
    }

    // 1. Connetti al database
    logger.info('📊 Connessione database...');
    dbClient = new SQLiteClient();
    await dbClient.connect();
    logger.info('✅ Database connesso\n');

    // 2. Ottieni estrattore FI
    logger.info('🔧 Inizializzazione estrattore FI...');
    const extractor = getExtractor('fi_extractor');
    logger.info('✅ Estrattore pronto\n');

    // 3. Esegui estrazione da SAP con retry
    logger.info('📥 Estrazione dati da SAP...');
    logger.info(`   Endpoint: ${process.env.SAP_BASE_URL || 'SAP_BASE_URL non configurato'}`);
    logger.info(`   Parametri: yearFrom=${params.yearFrom}, yearTo=${params.yearTo}`);
    
    const extractResult = await retryWithBackoff(
      () => extractor.run(params),
      3  // 3 tentativi con backoff
    );

    if (!extractResult.success) {
      throw new Error(`Estrazione fallita: ${extractResult.error}`);
    }

    const sapData = extractResult.data;
    logger.info(`✅ Estratti ${sapData.length} record da SAP in ${extractResult.duration}ms\n`);

    if (sapData.length === 0) {
      logger.warn('⚠️  Nessun dato estratto da SAP');
      logger.info('\n💡 Possibili cause:');
      logger.info('   - Nessun dato presente per gli anni richiesti');
      logger.info('   - Errore di connessione SAP (controlla SAP_BASE_URL)');
      logger.info('   - Credenziali SAP non valide\n');
      return;
    }

    // 4. Trasforma dati
    logger.info('🔄 Trasformazione dati...');
    const extractionDate = new Date().toISOString();
    const jobId = `manual_extraction_${Date.now()}`;
    const normalizedData = transformSapFiData(sapData, jobId, extractionDate);
    
    if (normalizedData.length === 0) {
      logger.error('❌ Nessun dato dopo trasformazione');
      return;
    }

    logger.info(`✅ Trasformati ${normalizedData.length} record normalizzati\n`);

    // 5. Valida dati
    logger.info('✔️  Validazione dati...');
    const { valid, invalid } = validateBatch(normalizedData);
    
    if (valid.length === 0) {
      logger.error('❌ Tutti i record sono invalidi');
      logger.error(`   Record invalidi: ${invalid.length}`);
      
      // Mostra primi 5 errori
      logger.error('\n   Primi errori:');
      invalid.slice(0, 5).forEach((item, i) => {
        logger.error(`   ${i + 1}. ${item.error}`);
      });
      return;
    }

    if (invalid.length > 0) {
      logger.warn(`⚠️  ${invalid.length} record invalidi saranno scartati`);
    }
    
    logger.info(`✅ ${valid.length} record validi pronti per inserimento\n`);

    // 6. Inserisci in database
    logger.info('💾 Inserimento dati in database...');
    logger.info(`   Tabella: sap_fi_data`);
    
    const inserted = await dbClient.insertBatch('sap_fi_data', valid);
    
    logger.info(`✅ Inseriti ${inserted} record in database\n`);

    // 7. Statistiche finali
    const duration = Date.now() - startTime;
    
    logger.info('='.repeat(70));
    logger.info('📊 RIEPILOGO ESTRAZIONE');
    logger.info('='.repeat(70));
    logger.info(`✅ Record estratti da SAP:    ${sapData.length}`);
    logger.info(`✅ Record normalizzati:       ${normalizedData.length}`);
    logger.info(`✅ Record validi:             ${valid.length}`);
    if (invalid.length > 0) {
      logger.info(`⚠️  Record scartati:          ${invalid.length}`);
    }
    logger.info(`✅ Record inseriti in DB:     ${inserted}`);
    logger.info(`⏱️  Durata totale:             ${(duration / 1000).toFixed(2)}s`);
    logger.info('='.repeat(70));

    // 8. Verifica dati inseriti
    logger.info('\n📈 Verifica dati inseriti:');
    for (let year = params.yearFrom; year <= params.yearTo; year++) {
      const count = await dbClient.query(
        'SELECT COUNT(*) as count FROM sap_fi_data WHERE fiscal_year = ?',
        [year]
      );
      logger.info(`   Anno ${year}: ${count[0].count} record`);
    }

    logger.info('\n✅ Estrazione completata con successo!\n');

  } catch (error) {
    logger.error('\n' + '='.repeat(70));
    logger.error('❌ ERRORE ESTRAZIONE');
    logger.error('='.repeat(70));
    logger.error(`Messaggio: ${error.message}`);
    
    if (error.stack) {
      logger.error('\nStack trace:');
      logger.error(error.stack);
    }
    
    logger.error('='.repeat(70) + '\n');
    
    process.exit(1);
  } finally {
    if (dbClient) {
      await dbClient.close();
      logger.info('📊 Database disconnesso\n');
    }
  }
}

// Esegui script
extractAndImportData();
