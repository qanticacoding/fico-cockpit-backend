# SAP Data Extractor - Specifiche Architetturali

**Data creazione:** 2026-05-01  
**Versione:** 1.0  
**Stato:** In definizione

---

## 📋 Indice

1. [Obiettivo del Progetto](#obiettivo)
2. [Architettura Reportistica](#architettura-reportistica)
3. [Stato Implementazione](#stato-implementazione)
4. [Decisioni Architetturali](#decisioni)
5. [Stack Tecnologico](#stack)
6. [Architettura Top-Down](#architettura)
7. [API SAP](#api-sap)
8. [Struttura Progetto](#struttura)
9. [Definizione Job](#job-definitions)
10. [Strutture Tabelle DuckDB](#tabelle-duckdb)
11. [Estrattori SAP](#estrattori-sap)
12. [Roadmap](#roadmap)
13. [TODO](#todo)

---

## 🎯 Obiettivo del Progetto {#obiettivo}

Creare un sistema Node.js completo per:

1. **Estrazione dati da SAP** tramite API custom e caricamento in DuckDB
2. **Gestione Set SAP** (raggruppamenti conti/centri di costo)
3. **Sistema reportistico flessibile** basato su voci configurabili

### Fasi Progetto

- **Fase 1:** Estrazione dati contabili e storage locale in DuckDB ✅
- **Fase 2:** Estrazione e gestione Set SAP ⏳
- **Fase 3:** Sistema voci e report configurabili ⏳
- **Fase 4:** Sincronizzazione su AWS S3 📋
- **Fase 5:** Query dirette su S3 tramite DuckDB 📋

---

## 📊 Architettura Reportistica {#architettura-reportistica}

Il sistema implementa un'architettura a 4 livelli per la creazione di report flessibili:

```
┌─────────────────────────────────────────────────────────────┐
│ LIVELLO 4: REPORT COMPOSTI                                  │
│ Orchestrazione voci gerarchiche + layout + presentazione   │
│                                                             │
│ Report = {                                                  │
│   metadata: { name, description, author },                  │
│   voci: [ lista voci con dipendenze ],                      │
│   layout: { sezioni, ordinamento, visibilità },             │
│   formati: [ JSON, CSV, Excel, PDF ]                        │
│ }                                                           │
│                                                             │
│ 📋 Esempio Report "Break Even Q1 2025":                     │
│                                                             │
│   Sezione 1: RICAVI (Base - Livello 1)                      │
│     ├─ RICAVI_VENDITE       → Set SAP + DuckDB              │
│     └─ ALTRI_RICAVI         → Set SAP + DuckDB              │
│                                                             │
│   Sezione 2: COSTI (Base - Livello 1)                       │
│     ├─ COSTI_VARIABILI      → Set SAP + DuckDB              │
│     └─ COSTI_FISSI          → Set SAP + DuckDB              │
│                                                             │
│   Sezione 3: MARGINI (Calcolati - Livello 2-3)              │
│     ├─ RICAVI_TOTALI        = RICAVI_VENDITE + ALTRI_RICAVI │
│     ├─ MARGINE_CONTRIBUZIONE = RICAVI_TOTALI - COSTI_VAR    │
│     └─ UTILE_OPERATIVO      = MARGINE_CONTRIB - COSTI_FISSI │
│                                                             │
│   Sezione 4: INDICATORI (Calcolati - Livello 4+)            │
│     ├─ MARGINE_PERCENTUALE  = (MARGINE_CONTRIB/RICAVI)*100  │
│     ├─ BREAK_EVEN_POINT     = COSTI_FISSI / MARGINE_%       │
│     └─ SAFETY_MARGIN        = RICAVI_TOTALI - BREAK_EVEN    │
│                                                             │
│ 🔄 Esecuzione Report:                                        │
│   1. Carica definizione voci con dipendenze                 │
│   2. Topological sort → ordine calcolo                      │
│   3. Esegui voci base (L1): API Set → DuckDB query          │
│   4. Esegui voci calcolate (L2+): formule ricorsive         │
│   5. Applica layout e formato output                        │
└─────────────────────────────────────────────────────────────┘
                          ↑
┌─────────────────────────────────────────────────────────────┐
│ LIVELLO 3: VOCI REPORT (GERARCHIA RICORSIVA)               │
│ Sistema a n livelli con grafo di dipendenze                │
│                                                             │
│ 🔹 VOCE BASE TIPO A (Livello 1 - Solo Set Conti):          │
│   ├─ Riferimento a Set Conti (SetClass 0109)               │
│   ├─ Filtri temporali (anno, periodi)                      │
│   ├─ Aggregazione (SUM, AVG, COUNT)                        │
│   └─ Query: WHERE account IN (set_membri)                  │
│                                                             │
│ 🔸 VOCE BASE TIPO B (Livello 1 - Set Conti + Filtro CDC):  │
│   ├─ Riferimento a Set Conti (SetClass 0109)               │
│   ├─ Riferimento a Set CDC (SetClass 0101) - FILTRO        │
│   ├─ Filtri temporali (anno, periodi)                      │
│   ├─ Aggregazione (SUM, AVG, COUNT)                        │
│   └─ Query: WHERE account IN (...) AND cost_center IN (...) │
│                                                             │
│ 🔷 VOCE CALCOLATA (Livello n > 1):                          │
│   ├─ Formula con riferimenti ad altre voci                 │
│   ├─ Dipendenze: lista voci necessarie                     │
│   ├─ Operazioni: +, -, *, /, %, funzioni                   │
│   └─ Esempio: CDV = CDV_BASE + CDV_SGA_PRD + AMM_PRD       │
│                                                             │
│ 📊 Esempio Concreto: CDV (Costo Del Venduto)                │
│                                                             │
│   CDV (L2 - Calcolata) = ┐                                 │
│                          │                                 │
│   ├─ CDV_BASE (L1-A)     │→ Set 0109:CDV (tutti CDC)       │
│   │   Query: WHERE account IN (CDV_set)                    │
│   │                                                         │
│   ├─ CDV_SGA_PRD (L1-B)  │→ Set 0109:CDV_SGA + CDC 0101:PRD│
│   │   Query: WHERE account IN (CDV_SGA_set)                │
│   │               AND cost_center IN (PRD_set)             │
│   │                                                         │
│   └─ AMM_PRD (L1-B)      │→ Set 0109:AMM + CDC 0101:PRD    │
│       Query: WHERE account IN (AMM_set)                    │
│                   AND cost_center IN (PRD_set)             │
│                                                             │
│   Formula: CDV = CDV_BASE + CDV_SGA_PRD + AMM_PRD          │
│                                                             │
│ ⚙️  Engine di Valutazione:                                  │
│   ├─ Analisi dipendenze (topological sort)                 │
│   ├─ Validazione cicli (A→B→A = errore)                    │
│   ├─ Calcolo ordine esecuzione ottimale                    │
│   └─ Cache risultati intermedi                             │
└─────────────────────────────────────────────────────────────┘
                          ↑
┌─────────────────────────────────────────────────────────────┐
│ LIVELLO 2: SET SAP (DINAMICI - NON MEMORIZZATI)            │
│ Raggruppamenti logici di conti e/o centri di costo         │
│                                                             │
│ ⚡ LETTI IN TEMPO REALE da: /sap/bc/ybreakeven/yset        │
│ ⚠️  NON memorizzati in DuckDB (cambiano frequentemente)     │
│                                                             │
│ 📊 Due Tipi di Set (SetClass):                              │
│   ├─ 0109: Set di CONTI (GL Accounts)                      │
│   │   ├─ keyid numerico (es: "0038015430")                 │
│   │   ├─ Flat (hierlevel: 0)                               │
│   │   └─ Query: WHERE account IN (...)                     │
│   │                                                         │
│   └─ 0101: Set di CENTRI DI COSTO (Cost Centers)           │
│       ├─ keyid alfanumerico (es: "P_PSCROBO1", "ACQUMM")   │
│       ├─ Gerarchici (hierlevel: 0→1→2→3)                   │
│       └─ Query: WHERE cost_center IN (...)                 │
│                                                             │
│ 📘 Esempio Set Conti "SG_A" (Classe 0109):                  │
│   ├─ SetClass: 0109 (Conti)                                │
│   ├─ SetName: SG_A                                         │
│   ├─ Descrizione: Sales General & Administration           │
│   ├─ Membri: 55 conti (0038xxxxxx - 0068xxxxxx)            │
│   └─ File: sap_set_example.json                            │
│                                                             │
│ 🏭 Esempio Set CDC "PRD" (Classe 0101):                     │
│   ├─ SetClass: 0101 (Centri di Costo)                      │
│   ├─ SetName: PRD                                          │
│   ├─ Descrizione: Produzione                               │
│   ├─ Membri: 21 CDC (P_PSCROBO1, ACQUMM, RIMANENZE, ...)   │
│   ├─ Gerarchia: 4 livelli (Produzione→Gruppi→Centri)       │
│   └─ File: sap_set_cdc_example.json                        │
│                                                             │
│ 💡 Vantaggi lettura dinamica:                               │
│   ✓ Set sempre aggiornati                                  │
│   ✓ Nuovi conti/CDC disponibili immediatamente             │
│   ✓ No sincronizzazione necessaria                         │
│   ✓ Gerarchia CDC sempre allineata                         │
└─────────────────────────────────────────────────────────────┘
                          ↑
┌─────────────────────────────────────────────────────────────┐
│ LIVELLO 1: DATI BASE                                        │
│ Dati contabili grezzi normalizzati                         │
│                                                             │
│ Tabella: sap_fi_data                                       │
│                                                             │
│ Estratti da: /sap/bc/zfidata                               │
│                                                             │
│ Struttura:                                                  │
│   ├─ fiscal_year (anno)                                    │
│   ├─ fiscal_period (0=apertura, 1-12=mesi)                 │
│   ├─ account (conto contabile)                             │
│   ├─ cost_center (centro di costo)                         │
│   └─ amount (importo)                                      │
└─────────────────────────────────────────────────────────────┘
```

### Flusso Operativo Report (Gerarchia Ricorsiva)

```
1. Utente richiede Report "Break Even Q1 2025"
   ↓
2. Sistema carica definizione Report
   - Lista tutte le voci (base + calcolate)
   - Analizza dipendenze tra voci
   - Costruisce grafo dipendenze
   ↓
3. Validazione Grafo
   ✓ Verifica assenza cicli (A→B→C→A = ERRORE)
   ✓ Identifica voci base (livello 1, senza dipendenze)
   ✓ Calcola livelli gerarchici per ogni voce
   ↓
4. Topological Sort
   Ordine esecuzione: [L1_voci_base] → [L2_calcoli] → [L3_calcoli] → ... → [Ln]
   
   Esempio ordinamento:
     1. RICAVI_VENDITE (L1 - base)
     2. COSTI_MATERIE (L1 - base)
     3. COSTI_PERSONALE (L1 - base)
     4. MARGINE_LORDO (L2 - dipende da 1,2)
     5. MARGINE_NETTO (L3 - dipende da 4,3)
     6. MARGINE_PERCENTUALE (L4 - dipende da 5,1)
   ↓
5. Esecuzione Sequenziale per Livello

   🔹 LIVELLO 1A - Voci Base (solo Set Conti):
   
   Per ogni voce BASE_A:
     a) ⚡ CHIAMATA API SAP (real-time)
        GET /sap/bc/ybreakeven/yset?setclass=0109&setname=CDV_BASE
        
        Response (SetClass 0109 - Conti): {
          "setData": [
            {"keyid": "0012345678", "description": "Materie prime"},
            {"keyid": "0012345679", "description": "Semilavorati"}
          ],
          "setHier": [{"setclass": "0109", "groupname": "CDV_BASE", ...}]
        }
        
        💡 Set sempre aggiornato - configurazione ATTUALE da SAP
     
     b) 🗄️ QUERY DUCKDB (dati storici locali)
        SELECT SUM(amount) as total
        FROM sap_fi_data
        WHERE fiscal_year = 2025
          AND fiscal_period IN (1, 2, 3)
          AND account IN ('0012345678', '0012345679', ...)
        
        💡 Nessun filtro su cost_center - tutti i CDC
     
     c) 💾 Cache risultato
        { "cdv_base": 150000.00 }
   
   🔸 LIVELLO 1B - Voci Base (Set Conti + Filtro CDC):
   
   Per ogni voce BASE_B:
     a) ⚡ CHIAMATA API SAP 1 (Set Conti)
        GET /sap/bc/ybreakeven/yset?setclass=0109&setname=CDV_SGA
        
        Response: {
          "setData": [
            {"keyid": "0068015430", "description": "Costi auto"},
            {"keyid": "0068015030", "description": "Spese telefoniche"}
          ]
        }
     
     b) ⚡ CHIAMATA API SAP 2 (Set CDC - Filtro)
        GET /sap/bc/ybreakeven/yset?setclass=0101&setname=PRD
        
        Response: {
          "setData": [
            {"keyid": "P_PSCROBO1", "description": "Robot"},
            {"keyid": "ACQUMM", "description": "Acquisti"},
            {"keyid": "P_SAGOMA01", "description": "Sagomatura"}
          ]
        }
     
     c) 🗄️ QUERY DUCKDB (doppio filtro)
        SELECT SUM(amount) as total
        FROM sap_fi_data
        WHERE fiscal_year = 2025
          AND fiscal_period IN (1, 2, 3)
          AND account IN ('0068015430', '0068015030', ...)
          AND cost_center IN ('P_PSCROBO1', 'ACQUMM', 'P_SAGOMA01', ...)
        
        💡 Filtro combinato: solo conti CDV_SGA nei CDC di Produzione
     
     d) 💾 Cache risultato
        { "cdv_base": 150000.00, "cdv_sga_prd": 50000.00 }
   
   🔷 LIVELLO 2+ - Voci Calcolate:
   
   Per ogni voce calcolata (in ordine topologico):
     a) ✅ Verifica dipendenze risolte
        Tutte le voci di cui dipende sono già calcolate?
        
        Esempio: cdv_totale richiede [cdv_base, cdv_sga_prd, amm_prd]
        Cache attuale: {"cdv_base": 150000, "cdv_sga_prd": 50000, "amm_prd": 30000}
        ✅ Tutte disponibili → procedi
     
     b) 🧮 Valuta formula
        CDV_TOTALE = cdv_base + cdv_sga_prd + amm_prd
                   = 150000.00 + 50000.00 + 30000.00
                   = 230000.00
        
        Esempio avanzato (con operazioni multiple):
        MARGINE_NETTO = ricavi_totali - (cdv_totale + costi_operativi)
                      = 500000.00 - (230000.00 + 120000.00)
                      = 150000.00
     
     c) 💾 Cache risultato
        { "cdv_base": 150000, "cdv_sga_prd": 50000, "amm_prd": 30000, "cdv_totale": 230000 }
     
     d) ♻️ Ricorsione per livelli successivi
        Voci di livello 3 ora possono usare "cdv_totale" come dipendenza
        Voci di livello 3 ora possono usare risultati di livello 2
   ↓
6. Applica Layout Report
   - Raggruppa voci per sezioni
   - Applica formattazione (valuta, percentuali)
   - Aggiunge metadata (data esecuzione, parametri)
   ↓
7. Restituisce Report Completo
   {
     "report": "Break Even Q1 2025",
     "execution_date": "2026-05-01T10:30:00Z",
     "sections": [
       { "name": "Ricavi", "voci": [...] },
       { "name": "Costi", "voci": [...] },
       { "name": "Margini", "voci": [...] },
       { "name": "Indicatori", "voci": [...] }
     ],
     "execution_time_ms": 1234
   }
```

### 🎯 Vantaggi Architettura Ricorsiva

| Caratteristica | Beneficio |
|----------------|----------|
| **N Livelli** | Complessità illimitata, formule su formule |
| **Riuso Voci** | Una voce calcolata usabile in più report |
| **Manutenibilità** | Modifica formula in un punto, effetto su tutti i report |
| **Performance** | Cache risultati intermedi, no ricalcolo |
| **Validazione** | Rilevamento cicli automatico |
| **Debug** | Tracciabilità calcolo per ogni voce |
| **Filtri Combinati** | Set Conti + Filtro Set CDC (Tipo BASE_B) |

### 💼 Casi d'Uso Pratici

**Esempio 1: CDV (Costo Del Venduto)**
```
CDV = CDV_BASE + CDV_SGA_PRD + AMM_PRD

Dove:
- CDV_BASE      → Set 0109:CDV per tutti i CDC
- CDV_SGA_PRD   → Set 0109:CDV_SGA filtrato per CDC 0101:PRD
- AMM_PRD       → Set 0109:AMM filtrato per CDC 0101:PRD
```

**Esempio 2: Margine per Linea Prodotto**
```
MARGINE_LINEA_A = RICAVI_LINEA_A - COSTI_LINEA_A

Dove:
- RICAVI_LINEA_A → Set 0109:RICAVI filtrato per CDC 0101:LINEA_A
- COSTI_LINEA_A  → Set 0109:COSTI filtrato per CDC 0101:LINEA_A
```

**Esempio 3: Break Even con Allocazioni**
```
BREAK_EVEN = COSTI_FISSI / MARGINE_CONTRIBUZIONE_PCT

Dove:
- COSTI_FISSI              → Set 0109:CF per tutti i CDC
- MARGINE_CONTRIBUZIONE_PCT = (RICAVI - COSTI_VAR) / RICAVI * 100
  - RICAVI     → Set 0109:RICAVI per tutti i CDC
  - COSTI_VAR  → Set 0109:CV per CDC 0101:PRODUZIONE + 0101:LOGISTICA
```

**File configurazione esempio:** `voice_config_cdv_example.json`

### 🔑 Decisione Architetturale: Storage vs API Real-Time

| Dato | Storage | Motivo |
|------|---------|--------|
| **Dati Contabili** (conti/cdc/importi) | 💾 DuckDB locale | Consuntivi immutabili, chiusi per periodo. Performance elevate per query complesse. |
| **Set SAP** (raggruppamenti) | ⚡ API real-time | Cambiano frequentemente (nuovi conti, modifiche set). Sempre aggiornati senza sincronizzazione. |

**Vantaggi approccio ibrido:**
- ✅ Dati storici veloci (locale)
- ✅ Set sempre aggiornati (nessuna cache stale)
- ✅ No job sincronizzazione set
- ✅ Nuovo conto in SAP → disponibile immediatamente nei report
- ✅ Semplificazione architettura (no tabelle sap_sets)

---

## ✅ Stato Implementazione {#stato-implementazione}

### Fase 1: Estrazione Dati Base ✅ COMPLETATO

**Componenti implementati:**

- ✅ Struttura progetto completa
- ✅ Configurazioni (SAP, DuckDB, Jobs)
- ✅ DuckDB Client con gestione connessioni
- ✅ Schema tabella `sap_fi_data` (dati normalizzati)
- ✅ Schema tabella `extraction_logs` (log estrazioni)
- ✅ Transformer: conversione wide → normalizzato
  - `hslvt` → period 0 (saldo anno precedente)
  - `hsl01-hsl12` → period 1-12 (mesi)
- ✅ Base Extractor (classe astratta)
- ✅ FI Extractor (estrattore dati contabili)
- ✅ Job Scheduler (cron-based)
- ✅ Job Runner (esecuzione sequenziale)
- ✅ Logger centralizzato
- ✅ Error handler con retry logic
- ✅ API REST:
  - GET /health
  - GET /api/jobs
  - POST /api/jobs/:id/run
  - GET /api/jobs/:id/status
  - GET /api/logs
  - GET /api/data/fi

**File creati:**
```
✅ package.json
✅ index.js
✅ .env.example → .env
✅ .gitignore
✅ README.md
✅ config/sap.config.js
✅ config/duckdb.config.js
✅ config/jobs.config.js
✅ src/utils/logger.js
✅ src/utils/error-handler.js
✅ src/storage/duckdb-client.js
✅ src/processors/transformer.js
✅ src/processors/validator.js
✅ src/extractors/base-extractor.js
✅ src/extractors/fi-extractor.js
✅ src/extractors/index.js
✅ src/scheduler/job-scheduler.js
✅ src/scheduler/job-runner.js
✅ jobs/extraction-jobs.js
✅ scripts/init-database.js
```

**Dati di esempio:**
```
✅ sap_fi_data_2025.json (780 record SAP)
```

---

### Fase 2: API Client Set SAP ⏳ DA IMPLEMENTARE

**Obiettivo:** Leggere Set SAP dinamicamente (real-time, non memorizzati)

**TODO:**

- [x] ✅ Analizzare struttura API `/sap/bc/ybreakeven/yset`
  - Esempio reale estratto: `SG_A` (Sales General & Administration)
  - Struttura: `setData` (membri) + `setHier` (metadata)
  - File: `sap_set_example.json` (55 conti)
- [x] ✅ Configurare endpoint Set in `sap.config.js`
  - Aggiunto `buildSetUrl(setclass, setname)`
  - Timeout dedicato: 15 secondi
- [ ] Creare SAP Set Client module:
  - HTTP client per chiamate set
  - Parser response SAP
  - Cache opzionale in-memory (TTL 5min)
- [ ] Error handling chiamate API set
- [ ] API REST per testare lettura set:
  - GET /api/sets/:setclass/:setname
  - GET /api/sets/test (verifica connettività)

**NON implementare:**
- ❌ Tabelle DuckDB per set (non necessarie)
- ❌ Job schedulati sincronizzazione (set letti on-demand)
- ❌ Storage persistente set (sempre da API)

---

### Fase 3: Sistema Voci Report (Gerarchia Ricorsiva) ⏳ PIANIFICATA

**Obiettivo:** Sistema gerarchico a n livelli con grafo di dipendenze

**TODO:**

**3.1 Strutture Dati:**
- [ ] Schema `report_voices` (voci base + calcolate):
  - id, name, type (BASE_A | BASE_B | CALCULATED)
  - **BASE_A**: Solo Set Conti
    - set_conti_ref (setclass, setname) - es: {class: "0109", name: "CDV"}
    - filters (year, periods)
    - aggregation (SUM, AVG, COUNT)
  - **BASE_B**: Set Conti + Filtro Set CDC
    - set_conti_ref (setclass, setname) - es: {class: "0109", name: "CDV_SGA"}
    - set_cdc_ref (setclass, setname) - es: {class: "0101", name: "PRD"}
    - filters (year, periods)
    - aggregation (SUM, AVG, COUNT)
  - **CALCULATED**: Formula su altre voci
    - formula (string expression) - es: "CDV_BASE + CDV_SGA_PRD + AMM_PRD"
    - dependencies (array di voice_id)
  - metadata (description, unit, format)

**3.1.1 Esempio Reale: CDV (Costo Del Venduto)**
```json
{
  "voices": [
    {
      "id": "cdv_base",
      "name": "CDV Base",
      "type": "BASE_A",
      "set_conti_ref": {"class": "0109", "name": "CDV"},
      "filters": {"year": 2025, "periods": [1,2,3,4,5,6]},
      "aggregation": "SUM"
    },
    {
      "id": "cdv_sga_prd",
      "name": "CDV SG&A Produzione",
      "type": "BASE_B",
      "set_conti_ref": {"class": "0109", "name": "CDV_SGA"},
      "set_cdc_ref": {"class": "0101", "name": "PRD"},
      "filters": {"year": 2025, "periods": [1,2,3,4,5,6]},
      "aggregation": "SUM"
    },
    {
      "id": "amm_prd",
      "name": "Ammortamenti Produzione",
      "type": "BASE_B",
      "set_conti_ref": {"class": "0109", "name": "AMM"},
      "set_cdc_ref": {"class": "0101", "name": "PRD"},
      "filters": {"year": 2025, "periods": [1,2,3,4,5,6]},
      "aggregation": "SUM"
    },
    {
      "id": "cdv_totale",
      "name": "Costo Del Venduto Totale",
      "type": "CALCULATED",
      "formula": "cdv_base + cdv_sga_prd + amm_prd",
      "dependencies": ["cdv_base", "cdv_sga_prd", "amm_prd"]
    }
  ]
}
```

**3.2 Engine di Valutazione:**
- [ ] Dependency Graph Builder
  - Parsing dipendenze da formule
  - Costruzione grafo aciclico
- [ ] Cycle Detection Algorithm
  - Validazione assenza cicli (A→B→A)
  - Error reporting con percorso ciclico
- [ ] Topological Sort
  - Calcolo ordine esecuzione ottimale
  - Livelli gerarchici (L1, L2, ..., Ln)
- [ ] Formula Evaluator
  - Parser espressioni: +, -, *, /, %, ()
  - Funzioni: SUM, AVG, MIN, MAX, COUNT, IF, ROUND
  - Sostituzione variabili con valori cached

**3.3 Esecuzione Voci:**
- [ ] Voice Executor per voci **BASE_A** (solo set conti):
  - Chiamata SAP Set API: GET /yset?setclass=0109&setname={name}
  - Estrazione membri: setData[].keyid
  - Query DuckDB:
    ```sql
    SELECT SUM(amount) FROM sap_fi_data
    WHERE fiscal_year = ? 
      AND fiscal_period IN (?)
      AND account IN (membri_set)
    ```
  - Aggregazione risultati
  
- [ ] Voice Executor per voci **BASE_B** (set conti + filtro CDC):
  - Chiamata SAP Set API 1: GET /yset?setclass=0109&setname={conti}
  - Chiamata SAP Set API 2: GET /yset?setclass=0101&setname={cdc}
  - Estrazione membri da entrambi i set
  - Query DuckDB:
    ```sql
    SELECT SUM(amount) FROM sap_fi_data
    WHERE fiscal_year = ? 
      AND fiscal_period IN (?)
      AND account IN (membri_set_conti)
      AND cost_center IN (membri_set_cdc)
    ```
  - Aggregazione risultati
  
- [ ] Voice Executor per voci **CALCULATED**:
  - Recupero valori dipendenze da cache
  - Valutazione formula
  - Gestione errori (divisione zero, null)
  
- [ ] Result Cache
  - Cache in-memory risultati intermedi
  - TTL configurable
  - Clear cache per ricalcolo

**3.3.1 Flusso Esecuzione Esempio CDV:**
```
1. Esegui cdv_base (BASE_A):
   API: /yset?setclass=0109&setname=CDV → ['00123...', '00124...']
   Query: WHERE account IN (...) → Result: 150000
   Cache: {"cdv_base": 150000}

2. Esegui cdv_sga_prd (BASE_B):
   API 1: /yset?setclass=0109&setname=CDV_SGA → ['00680...', '00681...']
   API 2: /yset?setclass=0101&setname=PRD → ['P_PSCROBO1', 'ACQUMM', ...]
   Query: WHERE account IN (...) AND cost_center IN (...) → Result: 50000
   Cache: {"cdv_base": 150000, "cdv_sga_prd": 50000}

3. Esegui amm_prd (BASE_B):
   API 1: /yset?setclass=0109&setname=AMM → ['00456...', '00457...']
   API 2: /yset?setclass=0101&setname=PRD → ['P_PSCROBO1', 'ACQUMM', ...]
   Query: WHERE account IN (...) AND cost_center IN (...) → Result: 30000
   Cache: {"cdv_base": 150000, "cdv_sga_prd": 50000, "amm_prd": 30000}

4. Esegui cdv_totale (CALCULATED):
   Formula: cdv_base + cdv_sga_prd + amm_prd
   Calcolo: 150000 + 50000 + 30000 = 230000
   Cache: {"cdv_base": 150000, "cdv_sga_prd": 50000, "amm_prd": 30000, "cdv_totale": 230000}
```

**3.4 API REST:**
- [ ] POST /api/voices (crea voce)
- [ ] GET /api/voices (lista voci)
- [ ] GET /api/voices/:id (dettaglio)
- [ ] PUT /api/voices/:id (aggiorna)
- [ ] DELETE /api/voices/:id (elimina)
- [ ] POST /api/voices/:id/execute (esegui singola voce)
- [ ] GET /api/voices/:id/dependencies (grafo dipendenze)
- [ ] POST /api/voices/validate (valida formula/dipendenze)

**3.5 Validazioni:**
- [ ] Sintassi formula corretta
- [ ] Dipendenze esistenti
- [ ] Assenza cicli
- [ ] Set SAP validi (per voci base)
- [ ] Periodi fiscali validi

---

### Fase 4: Report Composer (Orchestrazione) ⏳ PIANIFICATA

**Obiettivo:** Composizione report da voci gerarchiche + layout + export

**TODO:**

**4.1 Strutture Dati - Architettura a Due Livelli:**

🎯 **Separazione Voice Library ↔ Report Definitions**

### **LIVELLO 1: Voice Library (Libreria Centralizzata)**

File: `voice_library.json`

Contiene **tutte le voci riutilizzabili**:

```json
{
  "voice_library": {
    "name": "Voice Library - Finance",
    "version": "1.0.0"
  },
  "voices": {
    "ricavi_totali": {
      "id": "ricavi_totali",
      "name": "Ricavi Totali",
      "type": "BASE_A",
      "set_conti_ref": {"setclass": "0109", "setname": "RICAVI"},
      "filters": {"year": "{{year}}", "periods": "{{periods}}"},
      "metadata": {...}
    },
    "cdv_sga_prd": {
      "id": "cdv_sga_prd",
      "name": "CDV SG&A Produzione",
      "type": "BASE_B",
      "set_conti_ref": {"setclass": "0109", "setname": "CDV_SGA"},
      "set_cdc_ref": {"setclass": "0101", "setname": "PRD"},
      "metadata": {...}
    },
    "cdv_totale": {
      "id": "cdv_totale",
      "type": "CALCULATED",
      "formula": "cdv_base + cdv_sga_prd + amm_prd",
      "dependencies": ["cdv_base", "cdv_sga_prd", "amm_prd"],
      "metadata": {...}
    }
    // ... altre voci
  }
}
```

✅ **Vantaggi Voice Library:**
- Una voce definita **una volta**, usata in **N report**
- Modifiche centralizzate
- Versioning e ownership
- Categorizzazione

---

### **LIVELLO 2: Report Definitions (Configurazioni Report)**

File: `reports/breakeven_semestre_2025.json`

**Referenzia voci** dalla library:

```json
{
  "report": {
    "id": "breakeven_semestre_2025",
    "name": "Break Even Analysis - Primo Semestre 2025",
    "author": "Finance Team",
    "version": "1.0.0"
  },
  
  "voice_library_ref": {
    "source": "./voice_library.json",
    "comment": "Le voci sono nella libreria centralizzata"
  },
  
  "voices_used": [
    "ricavi_totali",
    "cdv_base",
    "cdv_sga_prd",
    "amm_prd",
    "cdv_totale",
    "margine_lordo",
    "ebit",
    "break_even_point",
    "safety_margin"
  ],
  
  "execution_params": {
    "default_year": 2025,
    "default_periods": [1, 2, 3, 4, 5, 6]
  },
  
  "layout": {
    "sections": [...]
  },
  
  "output_formats": [...],
  "validation_rules": [...],
  "scheduling": {...},
  "permissions": {...}
}
```

✅ **Vantaggi Report Definitions:**
- Focus su **layout e orchestrazione**
- Riuso voci tra report diversi
- Configurazione leggera
- Più report possono usare le stesse voci

---

**File esempio:**
- `voice_library.json` - 13 voci definite (3 BASE_A + 2 BASE_B + 8 CALCULATED)
- `reports/breakeven_semestre_2025.json` - Report che le referenzia
- `report_config_breakeven_example.json` - Esempio completo inline (per riferimento)

**4.1.1 Componenti Voice Library:**

- [x] **voice_library.name/version**: Metadata libreria
- [x] **voices**: Dizionario con tutte le voci
  - **id**: Identificatore univoco
  - **name/description**: Intestazione
  - **type**: BASE_A | BASE_B | CALCULATED
  - **set_conti_ref**: Riferimento Set Conti (0109)
  - **set_cdc_ref**: Riferimento Set CDC (0101) - solo BASE_B
  - **formula/dependencies**: Solo per CALCULATED
  - **filters**: Template variables `{{year}}`, `{{periods}}`
  - **metadata**: unit, format, category, owner, timestamps
- [x] **categories**: Raggruppamento voci per tipo
- [x] **usage_notes**: Documentazione riuso

**4.1.2 Componenti Report Definition:**

- [x] **report**: Metadata (id, nome, descrizione, autore, versione, categoria, tags)
- [x] **voice_library_ref**: Path al file libreria
- [x] **voices_used**: Array di id voci da eseguire
- [x] **execution_params**: Parametri di default (anno, periodi, currency, override)
- [x] **layout**: Organizzazione output
  - **sections**: Raggruppamento logico voci
  - **order**: Sequenza di visualizzazione
  - **style**: Formattazione (colori, font, bordi)
  - **show_total**: Calcolo subtotali per sezione
- [x] **output_formats**: Formati di export disponibili
  - JSON, CSV, Excel, PDF
  - Opzioni specifiche per formato
- [x] **validation_rules**: Regole di business
  - Error (blocca esecuzione)
  - Warning (prosegue con alert)
- [x] **scheduling**: Esecuzione automatica
  - Cron expression
  - Auto-export
  - Notifiche email
- [x] **permissions**: Controllo accessi
  - View, Execute, Edit, Delete

**4.1.3 Flusso Operativo:**

1. **Creazione Voci** (una volta):
   - Definire voci in `voice_library.json`
   - Testare singolarmente
   - Versionare

2. **Creazione Report** (più volte):
   - Creare file in `reports/{nome_report}.json`
   - Referenziare voci da library
   - Definire layout e output
   - Configurare validazioni

3. **Esecuzione Report**:
   - Load voice_library.json
   - Risolvere voices_used
   - Eseguire topological sort
   - Applicare layout
   - Generare output

✅ **Vantaggi architettura separata:**
- **Riuso**: Stesso `ricavi_totali` in report Break Even, P&L, Budget
- **Manutenzione**: Modifichi formula `cdv_totale` in un posto → si propaga a tutti i report
- **Versioning**: Voice library e report hanno versioni indipendenti
- **Governance**: Ownership centralizzato delle voci
- **Testing**: Puoi testare le voci indipendentemente dai report


---

**4.2 Report Definition Loader:**
- [ ] Voice Library Loader
  - Carica `voice_library.json`
  - Parse e validazione struttura
  - Indicizzazione voci per id
  - Cache in memoria
  
- [ ] Report Config Loader
  - Carica `reports/{report_id}.json`
  - Validazione schema JSON
  - Risoluzione `voices_used` contro voice_library
  - Verifica esistenza tutte le voci

- [ ] Dependency Resolver
  - Espande dipendenze transitive (CALCULATED)
  - Costruisce grafo completo
  - Validazione coerenza

**4.3 Execution Orchestrator:**
- [ ] Topological sort delle voci
  - Ordine esecuzione basato su dependencies
  - Gestione livelli gerarchici (L1 → L2 → ... → Ln)
  
- [ ] Parallel Executor per voci BASE
  - Esecuzione parallela voci BASE_A e BASE_B (livello 1)
  - Chiamate API Set SAP concorrenti
  - Query DuckDB parallele
  - Pooling connessioni
  
- [ ] Sequential Executor per voci CALCULATED
  - Esecuzione sequenziale per livello gerarchico
  - Cache risultati per dipendenze
  - Risoluzione template variables
  - Progress tracking e logging

- [ ] Result Aggregator
  - Raccolta risultati di tutte le voci
  - Applicazione layout/sezioni dal report config
  - Calcoli finali (totali di sezione, percentuali)
  - Preparazione output strutturato

**4.4 Formula Engine (Report-Level):**
- [ ] Formule cross-sezione (oltre singole voci)
  - Comparazioni tra sezioni
  - Aggregazioni personalizzate
  
- [ ] Comparazioni temporali
  - Year-over-Year (YoY)
  - Month-over-Month (MoM)
  - Analisi trend
  
- [ ] Analisi varianze
  - Budget vs Actual
  - Forecast vs Actual
  - Delta analysis
  
- [ ] Conditional formatting rules
  - Applicazione regole styling basate su valori
  - Threshold alerts

**4.5 Export Multi-Formato:**
- [ ] **JSON Exporter** (struttura gerarchica)
  - Pretty print con indentazione
  - Include metadata e timestamps
  - Supporto nested sections
  
- [ ] **CSV Exporter** (flat, con sezioni)
  - Delimiter configurabile (; per Excel Italia)
  - Flatten sections con prefissi
  - Headers personalizzabili
  
- [ ] **Excel Exporter** (fogli multipli, formattazione)
  - Libreria: `exceljs` o `xlsx`
  - Formule Excel native
  - Grafici embedded (bar, pie, line)
  - Formattazione condizionale
  - Freeze panes e filtri
  - Multiple sheets (una per sezione)
  
- [ ] **PDF Exporter** (report professionale)
  - Libreria: `pdfkit` o `puppeteer` (HTML→PDF)
  - Template customizzabili con logo aziendale
  - Headers/footers con paginazione
  - Grafici vettoriali

**4.6 API REST Endpoints:**
- [ ] **Voice Library Management:**
  - `GET /api/voices` - Lista tutte le voci dalla library
  - `GET /api/voices/:id` - Dettaglio voce specifica
  - `GET /api/voices/categories` - Lista categorie
  - `POST /api/voices` - Aggiungi nuova voce (admin)
  - `PUT /api/voices/:id` - Modifica voce (admin)
  - `DELETE /api/voices/:id` - Elimina voce (admin)

- [ ] **Report Management:**
  - `GET /api/reports` - Lista tutti i report disponibili
  - `GET /api/reports/:id` - Dettaglio configurazione report
  - `POST /api/reports` - Crea nuovo report (admin)
  - `PUT /api/reports/:id` - Modifica report (admin)
  - `DELETE /api/reports/:id` - Elimina report (admin)

- [ ] **Report Execution:**
  - `POST /api/reports/:id/execute` - Esegue report
    - Body: `{year, periods, format, filters}`
    - Response: Output formattato + metadata
  - `GET /api/reports/:id/status` - Stato esecuzione (per async)
  - `GET /api/reports/:id/download/:format` - Download output

- [ ] **Validation & Testing:**
  - `POST /api/voices/:id/test` - Testa singola voce
  - `POST /api/reports/:id/validate` - Valida configurazione
  - `POST /api/reports/:id/dry-run` - Esecuzione test senza salvare
  - Header/footer, logo aziendale

**4.5 API REST:**
- [ ] POST /api/reports (crea report)
- [ ] GET /api/reports (lista report)
- [ ] GET /api/reports/:id (dettaglio)
- [ ] PUT /api/reports/:id (aggiorna)
- [ ] DELETE /api/reports/:id (elimina)
- [ ] POST /api/reports/:id/execute (esegui report)
  - Query params: year, periods, format
  - Response: report generato
- [ ] POST /api/reports/:id/schedule (pianifica esecuzione)
- [ ] GET /api/reports/:id/history (storico esecuzioni)

**4.6 Caching & Performance:**
- [ ] Cache risultati report
  - Invalidation strategy
  - Partial cache (solo voci base)
- [ ] Lazy loading voci
- [ ] Streaming per report grandi

**4.7 Validazioni:**
- [ ] Tutte le voci esistenti
- [ ] Parametri compatibili
- [ ] Layout valido
- [ ] Formato export supportato

---

## 🌐 API SAP {#api-sap}

### API 1: Dati Contabili (zfidata)

**Endpoint:** `http://sapr3prd.beltramesrl.local:8030/sap/bc/zfidata`

**Metodo:** GET

**Parametri:**
- `yearfrom` (required): Anno inizio estrazione (es: 2025)
- `yearto` (required): Anno fine estrazione (es: 2025)

**Esempio chiamata:**
```
GET http://sapr3prd.beltramesrl.local:8030/sap/bc/zfidata?yearfrom=2025&yearto=2025
```

**Response:** Array JSON

**Struttura record:**
```json
{
  "ryear": 2025,                    // Anno fiscale
  "racct": "0014001010",            // Conto contabile
  "txt50": "Clienti Italia",        // Descrizione conto
  "rcntr": "P_SAGOMA01",            // Centro di costo (opzionale)
  "ltext": "Sagomatura",            // Descrizione CDC (opzionale)
  "hslvt": 10000.00,                // Saldo anno precedente (opzionale)
  "hsl01": 600034.46,               // Saldo periodo 01 - Gennaio (opzionale)
  "hsl02": 30430.39,                // Saldo periodo 02 - Febbraio (opzionale)
  "hsl03": 2827.86,                 // ...
  "hsl04": 42011.69,
  "hsl05": 77679.37,
  "hsl06": 25840.55,
  "hsl07": 5758.06,
  "hsl08": -221743.52,
  "hsl09": 137510.12,
  "hsl10": -102633.60,
  "hsl11": -71400.73,
  "hsl12": -122411.82               // Saldo periodo 12 - Dicembre (opzionale)
}
```

**Campi presenti:**
- Obbligatori (100%): `ryear`, `racct`, `txt50`
- Opzionali: `rcntr`, `ltext`, `hslvt`, `hsl01-hsl12`

**Note:**
- Non tutti i record hanno tutti i periodi
- Record con centro di costo hanno spesso solo `hslvt`
- Valori possono essere negativi

**Statistiche estrazione 2025:**
- Totale record: 780
- Record con centro di costo: 597 (77%)
- Record con saldi mensili: ~509 (65%)

**Status:** ✅ Implementato (FIExtractor)

---

### API 2: Set SAP (ybreakeven/yset)

**Endpoint:** `http://sapr3prd.beltramesrl.local:8030/sap/bc/ybreakeven/yset`

**Metodo:** GET

**Parametri:**
- `setclass` (required): Classe del set
  - **0109**: Set di Conti Contabili (GL Accounts)
  - **0101**: Set di Centri di Costo (Cost Centers)
- `setname` (required): Nome del set (es: SG_A, PRD)

---

#### 📘 Esempio 1: Set Conti (Classe 0109)

**Chiamata:**
```
GET http://sapr3prd.beltramesrl.local:8030/sap/bc/ybreakeven/yset?setclass=0109&setname=SG_A
```

**Response:** Set **flat** (singolo livello)

```json
[{
  "setData": [
    {
      "keyid": "0038015430",
      "description": "Costi indeducibili automezzi"
    },
    {
      "keyid": "0068015030",
      "description": "Spese telefoniche"
    }
    // ... 55 membri totali
  ],
  "setHier": [{
    "setclass": "0109",
    "coArea": "Z001",
    "chrtAccts": "",
    "groupname": "SG_A",
    "hierlevel": 0,
    "valcount": 55,
    "descript": "Sales General & Administration"
  }]
}]
```

**Caratteristiche:**
- `keyid`: Numerico (es: "0038015430")
- `setHier`: Array con **1 elemento** (hierlevel: 0)
- Utilizzo: `WHERE account IN (keyid1, keyid2, ...)`
- File esempio: `sap_set_example.json`

---

#### 🏭 Esempio 2: Set Centri di Costo (Classe 0101)

**Chiamata:**
```
GET http://sapr3prd.beltramesrl.local:8030/sap/bc/ybreakeven/yset?setclass=0101&setname=PRD
```

**Response:** Set **gerarchico** (multipli livelli)

```json
[{
  "setData": [
    {
      "keyid": "P_PSCROBO1",
      "description": "Scarn. Punt. Robot"
    },
    {
      "keyid": "ACQUMM",
      "description": "Acquisti Mat. Stock"
    },
    {
      "keyid": "P_SAGOMA01",
      "description": "Sagomatura"
    }
    // ... 21 membri totali
  ],
  "setHier": [
    {
      "setclass": "0101",
      "groupname": "PRD",
      "hierlevel": 0,
      "valcount": 0,
      "descript": "Produzione"
    },
    {
      "setclass": "0101",
      "groupname": "MOD",
      "hierlevel": 1,
      "valcount": 1,
      "descript": "Modelleria R&D"
    },
    {
      "setclass": "0101",
      "groupname": "G_PRDMAC",
      "hierlevel": 2,
      "valcount": 0,
      "descript": "Centri Macchine"
    },
    {
      "setclass": "0101",
      "groupname": "G_TRANCE",
      "hierlevel": 3,
      "valcount": 3,
      "descript": "Trance"
    }
    // ... gerarchia completa con 20 elementi
  ]
}]
```

**Caratteristiche:**
- `keyid`: Alfanumerico (es: "P_PSCROBO1", "ACQUMM", "RIMANENZE")
- `setHier`: Array con **multipli elementi** (hierlevel: 0→1→2→3)
- Gerarchia:
  - **Level 0**: Radice (PRD)
  - **Level 1**: Sottoset principali (MOD, ACS, IPRD, DPRD)
  - **Level 2**: Gruppi (G_PRDMAC, G_PRDNMA)
  - **Level 3**: Dettagli (G_TRANCE, G_SMUSSA, G_SCARNI, ecc.)
- Utilizzo: `WHERE cost_center IN (keyid1, keyid2, ...)`
- File esempio: `sap_set_cdc_example.json`

---

#### 📋 Struttura Campi Comune

**setData** (array membri effettivi del set):
- `keyid`: ID conto o centro di costo (string)
- `description`: Descrizione testuale (string)

**setHier** (metadata e gerarchia del set):
- `setclass`: Classe del set (string: "0109" o "0101")
- `coArea`: Area di controllo (string, es: "Z001")
- `chrtAccts`: Piano dei conti (string, può essere vuoto)
- `groupname`: Nome del set/sotto-set (string)
- `hierlevel`: Livello gerarchico (number: 0=root, 1-3=sottolivelli)
- `valcount`: Numero di membri nel gruppo (number)
- `descript`: Descrizione del set/gruppo (string)

---

#### 💡 Note Operative

| Aspetto | Dettaglio |
|---------|-----------|
| **Lettura** | ⚡ Real-time (non memorizzati) |
| **Aggiornamento** | ✅ Sempre configurazione SAP corrente |
| **Query DuckDB** | 🔍 Conti: `account IN (...)` / CDC: `cost_center IN (...)` |
| **Gerarchia** | 📊 Conti: flat (1 livello) / CDC: gerarchica (4 livelli) |
| **Formato keyid** | 🔤 Conti: numerico / CDC: alfanumerico |
| **Utilizzo valcount** | ✔️ Validazione dimensione set |

**Status:** ✅ Struttura documentata, pronto per implementazione client

---

## ⚙️ Decisioni Architetturali {#decisioni}

### Scheduling
- **Tipo:** Cron jobs (node-cron)
- **Modalità:** Sequenziale (un estrattore alla volta)
- **Flessibilità:** Ogni job ha schedule indipendente (non raggruppati per tipologia)
- **Estensibilità futura:** Queue-based, Event-driven

### Storage
- **Database:** DuckDB (embedded)
- **Modalità scrittura:** Append-only
- **Caso d'uso:** Dati contabili mensili (storicizzazione)
- **Formato export:** Parquet per S3

### Estrattori
- **Formato output:** JSON
- **Gestione:** Estrattori custom forniti dall'utente
- **Interfaccia:** Standardizzata per integrazione

### Logging
- **Tipo:** Tabella DuckDB per log estrazioni
- **Dettaglio:** Job name, timestamp, status, record count, errori

---

## 🛠️ Stack Tecnologico {#stack}

```
├── Runtime:        Node.js (v18+)
├── Web Framework:  Express (API REST)
├── Database:       DuckDB (node-duckdb)
├── Scheduling:     node-cron
├── Logging:        Winston (opzionale)
├── Cloud Storage:  AWS SDK (S3) - Fase 2
└── Testing:        Jest (opzionale)
```

### Dipendenze Principali

```json
{
  "dependencies": {
    "express": "^4.18.x",
    "duckdb": "^0.10.x",
    "node-cron": "^3.0.x",
    "dotenv": "^16.0.x"
  }
}
```

---

## 🏗️ Architettura Top-Down {#architettura}

### Livello 1: Vista Sistema

```
┌─────────────────────────────────────────────────────────┐
│                    SAP SYSTEM                           │
│                   (API Endpoint)                        │
└──────────────────┬──────────────────────────────────────┘
                   │
                   │ HTTP/RFC calls
                   │
┌──────────────────▼──────────────────────────────────────┐
│              NODE.JS JOB SCHEDULER                      │
│  ┌──────────────────────────────────────────────┐      │
│  │  Extraction Jobs (Cron-based)                │      │
│  │  - Esecuzione sequenziale                    │      │
│  │  - Schedule indipendenti per job             │      │
│  └──────────────────────────────────────────────┘      │
└──────────────────┬──────────────────────────────────────┘
                   │
                   │ Append data
                   │
┌──────────────────▼──────────────────────────────────────┐
│              DUCKDB DATABASE (Locale)                   │
│  ┌────────────────────────────────────────────┐        │
│  │  Tabelle dati SAP (append-only)            │        │
│  │  Tabella extraction_logs                   │        │
│  └────────────────────────────────────────────┘        │
└─────────────────────────────────────────────────────────┘
                   │
                   │ Export Parquet (Fase 2)
                   ▼
           ┌──────────────────┐
           │    AWS S3        │
           └──────────────────┘
```

### Livello 2: Componenti Job Node.js

```
Job Scheduler
│
├── Configuration Layer
│   ├── SAP Connection Config (.env)
│   ├── DuckDB Config
│   ├── Job Definitions (jobs/extraction-jobs.js)
│   └── Logging Config
│
├── Orchestrator
│   ├── Job Queue Manager (sequenziale)
│   ├── Retry Logic
│   └── Error Handling
│
├── Extractors (forniti dall'utente)
│   ├── Base Extractor Interface
│   └── Custom Extractors
│
├── Data Processing
│   ├── JSON Validation
│   └── Schema Mapping
│
└── Storage Writer
    ├── DuckDB Client
    ├── Batch Insert Optimization
    └── Transaction Management
```

### Livello 3: Flusso Operativo

```
1. Cron Trigger (schedule specifico per job)
   ↓
2. Job Scheduler carica configurazione job
   ↓
3. Per ogni estrattore del job (sequenziale):
   │
   ├─ a) Inizializza connessione SAP
   ├─ b) Chiama estrattore con parametri
   ├─ c) Riceve array JSON
   ├─ d) Valida struttura dati
   ├─ e) Aggiunge metadata (timestamp, job_id, periodo)
   ├─ f) INSERT INTO DuckDB (append)
   └─ g) Log risultato in extraction_logs
   ↓
4. Notifica completamento job
   ↓
5. Chiusura connessioni
```

---

## 📁 Struttura Progetto {#struttura}

```
sap-duckdb-extractor/
│
├── config/
│   ├── sap.config.js              # Configurazione connessioni SAP
│   ├── duckdb.config.js           # Setup e path DuckDB
│   └── jobs.config.js             # Importa job definitions
│
├── src/
│   ├── extractors/
│   │   ├── index.js               # Registry estrattori
│   │   ├── base-extractor.js     # Classe base/interfaccia
│   │   └── [custom-extractors]/  # Gli estrattori forniti dall'utente
│   │
│   ├── processors/
│   │   ├── transformer.js        # Trasformazioni JSON
│   │   └── validator.js          # Validazione dati
│   │
│   ├── storage/
│   │   ├── duckdb-client.js      # Client DuckDB
│   │   ├── schema-manager.js     # Gestione DDL tabelle
│   │   └── batch-writer.js       # Insert batch ottimizzati
│   │
│   ├── scheduler/
│   │   ├── job-scheduler.js      # Gestione cron jobs
│   │   ├── job-runner.js         # Esecuzione singolo job
│   │   └── job-context.js        # Context/parametri job
│   │
│   └── utils/
│       ├── logger.js             # Logging system
│       ├── error-handler.js      # Gestione errori
│       └── date-utils.js         # Helper date/periodi
│
├── jobs/
│   └── extraction-jobs.js        # Definizioni job
│
├── data/
│   └── sap_data.duckdb           # File DuckDB
│
├── logs/
│   └── [log files]
│
├── tests/
│   └── [test files]
│
├── .env                          # Variabili ambiente
├── .env.example                  # Template env
├── .gitignore
├── package.json
├── README.md
└── index.js                      # Entry point applicazione
```

---

## 🔧 Definizione Job {#job-definitions}

### Template Job

```javascript
// jobs/extraction-jobs.js

const jobs = [
  {
    id: 'unique_job_id',              // ID univoco job
    name: 'Descrizione job',          // Nome descrittivo
    schedule: '0 2 1 * *',            // Cron expression
    extractors: [                     // Array estrattori da eseguire
      {
        name: 'extractor_name',       // Nome estrattore registrato
        targetTable: 'table_name',    // Tabella destinazione
        params: {                     // Parametri custom
          // parametri specifici estrattore
        }
      }
    ],
    enabled: true,                    // Attivo/disattivo
    retryOnError: 3,                  // Tentativi in caso di errore
    timeout: 3600000                  // Timeout in ms (1h)
  }
];

module.exports = jobs;
```

### Formato Cron Expression

```
* * * * *
│ │ │ │ │
│ │ │ │ └── Giorno settimana (0-7, 0 e 7 = domenica)
│ │ │ └──── Mese (1-12)
│ │ └────── Giorno mese (1-31)
│ └──────── Ora (0-23)
└────────── Minuto (0-59)

Esempi:
'0 2 1 * *'    = Ogni 1° del mese alle 02:00
'0 3 5 * *'    = Ogni 5° del mese alle 03:00
'0 1 * * *'    = Ogni giorno alle 01:00
'*/15 * * * *' = Ogni 15 minuti
'0 0 * * 1'    = Ogni lunedì a mezzanotte
```

---

## 📊 Job Configurati {#job-definitions}

### Job 1: Estrazione Contabilità Mensile

```javascript
{
  id: 'fi_monthly_extraction',
  name: 'Estrazione Contabilità Mensile',
  description: 'Estrae dati contabili FI dal mese precedente',
  
  // Schedule: Ogni 1° del mese alle 02:00
  schedule: '0 2 1 * *',
  
  extractors: [
    {
      name: 'fi_extractor',
      targetTable: 'sap_fi_data',
      params: {
        yearFrom: 2025,
        yearTo: 2025
      }
    }
  ],
  
  enabled: true,
  retryOnError: 3,
  timeout: 3600000  // 1 ora
}
```

**Status:** ✅ Implementato

---

### TODO: Job Futuri

Altri job da definire e implementare:
- Job estrazione controllo di gestione (CO)
- Job estrazione ordini vendita (SD)
- Job estrazione magazzino (MM)

---

## 🗄️ Strutture Tabelle DuckDB {#tabelle-duckdb}

### Tabella System: extraction_logs

```sql
CREATE TABLE extraction_logs (
  id INTEGER PRIMARY KEY,
  job_id VARCHAR NOT NULL,
  job_name VARCHAR NOT NULL,
  extractor_name VARCHAR,
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP,
  status VARCHAR NOT NULL,           -- 'running', 'success', 'failed', 'partial'
  records_extracted INTEGER,
  records_inserted INTEGER,
  error_message TEXT,
  metadata JSON,                      -- Info aggiuntive job
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_logs_job_id ON extraction_logs(job_id);
CREATE INDEX idx_logs_status ON extraction_logs(status);
CREATE INDEX idx_logs_start_time ON extraction_logs(start_time);
```

---

### TODO: Definire Tabelle Dati SAP

**Per ogni tabella specificare:**

1. **Nome tabella**
2. **Descrizione** (tipo di dati contenuti)
3. **Struttura campi:**
   - Nome campo
   - Tipo DuckDB (INTEGER, VARCHAR, DECIMAL, DATE, TIMESTAMP, JSON, etc.)
   - Constraint (NOT NULL, PRIMARY KEY, etc.)
4. **Indici** necessari
5. **Esempio JSON** output estrattore

---

**Template per definizione tabella:**

```sql
-- Tabella: [NOME_TABELLA]
-- Descrizione: [Descrizione dati]
-- Estrattore associato: [nome_estrattore]

CREATE TABLE [nome_tabella] (
  id INTEGER PRIMARY KEY,
  
  -- Campi chiave
  -- TODO: definire campi
  
  -- Metadata di sistema
  extraction_date TIMESTAMP NOT NULL,
  job_id VARCHAR NOT NULL,
  fiscal_year INTEGER,
  fiscal_period INTEGER,
  
  -- JSON raw per storico completo
  raw_data JSON,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indici
CREATE INDEX idx_[nome]_year ON [nome_tabella](fiscal_year);
CREATE INDEX idx_[nome]_period ON [nome_tabella](fiscal_period);
```

**Esempio JSON estrattore:**

```json
[
  {
    // TODO: fornire esempio reale JSON output estrattore
  }
]
```

---

## 🔌 Estrattori SAP {#estrattori-sap}

### Interfaccia Base Extractor

```javascript
// src/extractors/base-extractor.js

class BaseExtractor {
  constructor(config) {
    this.config = config;
    this.name = this.constructor.name;
  }

  /**
   * Metodo da implementare in ogni estrattore
   * @param {Object} params - Parametri estrattore
   * @returns {Promise<Array>} - Array di oggetti JSON
   */
  async extract(params) {
    throw new Error('extract() must be implemented');
  }

  /**
   * Validazione parametri
   * @param {Object} params
   * @returns {boolean}
   */
  validateParams(params) {
    return true; // Override per validazioni custom
  }

  /**
   * Hook pre-estrazione
   */
  async beforeExtract(params) {
    // Override se necessario
  }

  /**
   * Hook post-estrazione
   */
  async afterExtract(data, params) {
    // Override se necessario
    return data;
  }
}

module.exports = BaseExtractor;
```

---

### TODO: Registrare Estrattori Custom

**Per ogni estrattore fornire:**

1. **Nome identificativo** (usato nelle job definitions)
2. **Classe/file** implementazione
3. **Parametri accettati**
4. **Formato output JSON**
5. **Note specifiche** (timeout, limiti, prerequisiti)

---

**Template registrazione:**

```javascript
// src/extractors/index.js

const extractorRegistry = {
  
  // TODO: registrare estrattori custom
  
  'extractor_name': {
    class: require('./custom/extractor-file'),
    description: 'Descrizione estrattore',
    params: {
      // Parametri richiesti/opzionali
    },
    outputSample: {
      // Esempio output JSON
    }
  }
  
};

module.exports = extractorRegistry;
```

---

## 🗺️ Roadmap {#roadmap}

### Fase 1: Estrazione Dati Base ✅ COMPLETATO

- [x] Definizione architettura
- [x] Setup progetto base
- [x] Implementazione DuckDB client
- [x] Schema tabelle (sap_fi_data, extraction_logs)
- [x] Transformer normalizzazione dati
- [x] Implementazione job scheduler (cron-based)
- [x] Base Extractor + FI Extractor
- [x] Job Runner (esecuzione sequenziale)
- [x] Logging e error handling
- [x] API REST base
- [x] Script inizializzazione DB

**Prossimo:** Installare dipendenze e testare estrazione

---

### Fase 2: API Client Set SAP ⏳ PROSSIMA FASE

**Obiettivo:** Leggere Set SAP dinamicamente (real-time, NON memorizzati)

**Architettura:**
- ⚡ Set letti da API SAP al momento dell'esecuzione report
- 💾 Dati contabili letti da DuckDB locale (già memorizzati)
- 🎯 Set sempre aggiornati, no sincronizzazione

**Task:**
- [ ] Analizzare API `/sap/bc/ybreakeven/yset`
- [ ] Creare SAP Set Client module:
  - HTTP client per chiamate set
  - Parser response SAP
  - Cache opzionale in-memory (TTL 5min)
- [ ] Validazione set (esistenza, membri validi)
- [ ] Error handling robusto
- [ ] API REST test:
  - GET /api/sets/:setclass/:setname
  - GET /api/sets/test (verifica connettività)

**NON implementare:**
- ❌ Storage DuckDB per set
- ❌ Job schedulati
- ❌ Sincronizzazione

**Blocco attuale:** Serve esempio chiamata API set per analizzare struttura

---

### Fase 3 e 4: Voci Report e Composizione ⏳ PIANIFICATE

Vedere sezioni dettagliate sopra:
- **Fase 3: Sistema Voci Report (Gerarchia Ricorsiva)** - [Link](#stato-implementazione)
- **Fase 4: Report Composer (Orchestrazione)** - [Link](#stato-implementazione)

**Architettura:**
- Sistema a **n livelli** con grafo di dipendenze ricorsivo
- Voci BASE (L1): interrogano Set SAP + DuckDB
- Voci CALCOLATE (L2+): formule con riferimenti ad altre voci
- Topological sort per ordine esecuzione
- Cache risultati intermedi

---

### Fase 5: Storage S3 ☁️ FUTURO

- [ ] Export DuckDB → Parquet
- [ ] Upload automatico S3
- [ ] Versionamento dataset
- [ ] Sincronizzazione incrementale

---

### Fase 6: Query Cloud 🌐 FUTURO

- [ ] DuckDB direct S3 query
- [ ] API REST per query remote
- [ ] Caching risultati
- [ ] Dashboard visualizzazione

---

### Fase 7: Ottimizzazioni ⚡ FUTURO

- [ ] Queue-based scheduling (Bull/BullMQ)
- [ ] Parallelizzazione estrattori
- [ ] Compressione avanzata
- [ ] Alerting e notifiche
- [ ] Autenticazione API
- [ ] Rate limiting

---

## ✅ TODO Immediati {#todo}

### 🔴 Priorità Alta

1. **Installare dipendenze Node.js**
   ```bash
   cd DUCKDB
   npm install
   ```

2. **Testare inizializzazione database**
   ```bash
   npm run init-db
   ```

3. **Testare estrazione dati FI**
   ```bash
   npm start
   # oppure esecuzione manuale via API:
   # POST http://localhost:3000/api/jobs/fi_monthly_extraction/run
   ```

4. **Analizzare API Set SAP**
   - Serve chiamata esempio a `/sap/bc/ybreakeven/yset`
   - Parametri: `setclass=?` e `setname=?` (valori reali)
   - Analizzare struttura response

---

### 🟡 Priorità Media

5. **Configurare parametri dinamici job**
   - Anno corrente invece di hardcoded 2025
   - Parametri da .env o runtime

6. **Implementare Set Extractor** (dopo analisi API)

7. **Definire modello dati Voci Report**

8. **Documentare esempi report reali** (Break Even, P&L, etc.)

---

### 🟢 Priorità Bassa

9. **Frontend UI** per gestione report (opzionale)

10. **Notifiche email** per job falliti

11. **Export automatico** risultati report

---

## 📝 Note Implementative

### Best Practices

1. **Gestione Errori:**
   - Retry automatico con backoff esponenziale
   - Logging dettagliato errori
   - Continuazione job anche con estrattori falliti (partial success)

2. **Performance:**
   - Batch insert DuckDB (1000 record/batch)
   - Transazioni per atomicità
   - Indici su campi frequentemente filtrati

3. **Manutenibilità:**
   - Configurazioni esterne (.env)
   - Validazione parametri
   - Documentazione inline

4. **Sicurezza:**
   - Nessuna credenziale hardcoded
   - Sanitizzazione input
   - Limitazione risorse (timeout, max records)

---

## 📚 Riferimenti

- [DuckDB Node.js](https://duckdb.org/docs/api/nodejs/overview)
- [node-cron](https://www.npmjs.com/package/node-cron)
- [Express.js](https://expressjs.com/)
- [DuckDB S3 Integration](https://duckdb.org/docs/guides/import/s3_import)

---

---

**Documento aggiornato:** 2026-05-01  
**Versione:** 2.0  
**Fase corrente:** Fase 1 ✅ Completata | Fase 2 ⏳ Prossima  
**Prossimi step:** 
1. Testare estrazione dati (npm install + npm run init-db)
2. Analizzare API Set SAP con chiamata reale
3. Implementare gestione Set
