# 📘 Guida Utilizzo - SAP SQLite Extractor

Sistema di estrazione e analisi dati SAP con architettura a 4 livelli: dati di base, set dinamici, libreria voci e report configurabili.

---

## 📑 Indice

1. [Avvio Rapido](#-avvio-rapido)
2. [Architettura del Sistema](#-architettura-del-sistema)
3. [API Endpoints](#-api-endpoints)
4. [Estrazione Dati](#-estrazione-dati)
5. [Query Dati](#-query-dati)
6. [Gestione Set SAP](#-gestione-set-sap)
7. [Libreria Voci](#-libreria-voci)
8. [Configurazione Report](#-configurazione-report)
9. [Esempi Pratici](#-esempi-pratici)
10. [Troubleshooting](#-troubleshooting)

---

## 🚀 Avvio Rapido

### 1. Avvio Server

```powershell
cd fico_cockpit_back
npm start
```

**Output atteso:**
```
[INFO] Server in ascolto su http://localhost:3000
[INFO] SQLite connesso: ./data/sap_data.db
[INFO] Schema database inizializzato
[INFO] 10 indici creati
[INFO] Scheduler avviato con 1 job
```

### 2. Verifica Stato Sistema

```powershell
# Health check
Invoke-RestMethod -Uri "http://localhost:3000/health" | ConvertTo-Json
```

**Risposta:**
```json
{
  "status": "ok",
  "timestamp": "2026-05-02T16:43:33.625Z",
  "database": "connected",
  "scheduler": "running"
}
```

---

## 🏗️ Architettura del Sistema

Il sistema implementa un'architettura a **4 livelli**:

```
┌─────────────────────────────────────────────────────────────┐
│ LIVELLO 4: REPORT CONFIGURABILI                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ reports/breakeven_semestre_2025.json                    │ │
│ │ - Configurazione JSON                                   │ │
│ │ - Selezione voci da libreria                            │ │
│ │ - Parametri esecuzione                                  │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ LIVELLO 3: LIBRERIA VOCI                                    │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ voice_library.json                                      │ │
│ │ - Voci riutilizzabili                                   │ │
│ │ - BASE_A: Solo conti                                    │ │
│ │ - BASE_B: Conti + CDC                                   │ │
│ │ - CALCULATED: Formule con dipendenze                    │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ LIVELLO 2: SET SAP (DINAMICI)                               │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ API: http://sapr3prd:8030/sap/bc/ybreakeven/yset       │ │
│ │ - 0109: Conti (flat, numerico)                          │ │
│ │ - 0101: CDC (gerarchico, alfanumerico)                  │ │
│ │ - Cache TTL: 5 minuti                                   │ │
│ │ - NON memorizzati in database                           │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│ LIVELLO 1: DATI DI BASE (STORICI)                           │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ SQLite: ./data/sap_data.db                              │ │
│ │ - Tabella: sap_fi_data                                  │ │
│ │ - Dati immutabili (append-only)                         │ │
│ │ - 780 record SAP → 4911 record normalizzati/anno        │ │
│ │ - fiscal_period: 0-12 (0=saldo iniziale, 1-12=mesi)    │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Principi Architetturali

1. **Dati Storici = Database**: I dati contabili sono immutabili e vengono memorizzati
2. **Set = Dinamici**: Le definizioni dei set vengono lette in tempo reale da SAP
3. **Voci = Libreria Riutilizzabile**: Definizioni centrali usate da più report
4. **Report = Configurazione JSON**: Massima flessibilità senza modifiche al codice

---

## 📡 API Endpoints

### Health & Status

```powershell
# Health check
GET http://localhost:3000/health

# Jobs disponibili
GET http://localhost:3000/api/jobs
```

### Estrazione Dati

```powershell
# Esegui job manualmente
POST http://localhost:3000/api/jobs/fi_monthly_extraction/run

# Stato job
GET http://localhost:3000/api/jobs/fi_monthly_extraction/status
```

### Query Dati

```powershell
# Tutti i dati anno 2025 (max 1000 record)
GET http://localhost:3000/api/data/fi?year=2025

# Dati per account specifico
GET http://localhost:3000/api/data/fi?year=2025&account=0014001010
```

### Set SAP

```powershell
# Test connessione SAP Set API
GET http://localhost:3000/api/sets/test

# Ottieni definizione set
GET http://localhost:3000/api/sets/0109/RICAVI

# Statistiche cache
GET http://localhost:3000/api/sets/cache/stats

# Pulisci cache
DELETE http://localhost:3000/api/sets/cache
```

### Logs

```powershell
# Ultimi log estrazioni
GET http://localhost:3000/api/logs?limit=10
```

---

## 💾 Estrazione Dati

### Estrazione Manuale

```powershell
# Esegui estrazione anno corrente (2025)
Invoke-RestMethod -Uri "http://localhost:3000/api/jobs/fi_monthly_extraction/run" -Method Post | ConvertTo-Json
```

**Output:**
```json
{
  "success": true,
  "message": "Job fi_monthly_extraction avviato",
  "timestamp": "2026-05-02T16:43:49.209Z"
}
```

**Log Server (monitorare terminale):**
```
[INFO] JOB START: Estrazione Contabilità Mensile (fi_monthly_extraction)
[INFO] [FIExtractor] Estrazione dati FI: anno 2025 - 2025
[INFO] [FIExtractor] Ricevuti 780 record da SAP
[INFO] FIExtractor: Estratti 780 record in 778ms
[INFO] Trasformati 4911 record normalizzati da 780 record SAP
[INFO] Totale record inseriti in sap_fi_data: 4911
[INFO] JOB SUCCESS: Estrazione Contabilità Mensile
[INFO] Durata: 1152ms | Estratti: 780 | Inseriti: 4911
```

### Modifica Anni da Estrarre

Modifica il file `config/jobs.config.js`:

```javascript
{
  id: 'fi_monthly_extraction',
  name: 'Estrazione Contabilità Mensile',
  schedule: '0 2 1 * *',  // Primo giorno del mese alle 2:00
  enabled: true,
  extractors: [
    {
      name: 'fi_extractor',
      params: {
        yearFrom: 2020,  // ← Modifica anno iniziale
        yearTo: 2025     // ← Modifica anno finale
      },
      targetTable: 'sap_fi_data'
    }
  ]
}
```

**Poi riavvia il server e riesegui il job.**

### Schedulazione Automatica

Il job è configurato per eseguire automaticamente:
- **Quando:** Primo giorno di ogni mese alle 2:00 AM
- **Espressione Cron:** `0 2 1 * *`
- **Comportamento:** Append-only (non sovrascrive dati esistenti)

Per modificare lo schedule, edita `config/jobs.config.js`.

---

## 🔍 Query Dati

### Query Base

```powershell
# Tutti i dati anno 2025
$result = Invoke-RestMethod -Uri "http://localhost:3000/api/data/fi?year=2025"
Write-Host "Totale record: $($result.count)"
$result.data | Select-Object -First 5 | Format-Table

# Dati per account specifico
$result = Invoke-RestMethod -Uri "http://localhost:3000/api/data/fi?year=2025&account=0014001010"
$result.data | Format-Table fiscal_period, amount -AutoSize
```

### Struttura Record

Ogni record normalizzato ha questa struttura:

```json
{
  "id": 1,
  "fiscal_year": 2025,
  "account": "0014001010",
  "account_desc": "Clienti Italia",
  "cost_center": null,
  "cost_center_desc": null,
  "fiscal_period": 1,
  "amount": 600034.46,
  "extraction_date": "2026-05-02T16:43:48.424Z",
  "job_id": "fi_monthly_extraction",
  "created_at": "2026-05-02 16:43:48"
}
```

**Campi Chiave:**
- `fiscal_period`: 
  - **0** = Saldo iniziale anno (hslvt in SAP)
  - **1-12** = Movimenti mensili (hsl01-hsl12 in SAP)
- `cost_center`: Può essere NULL per conti senza CDC
- `amount`: Valore REAL (può essere negativo)

### Aggregazioni

Per aggregazioni complesse, usa SQLite direttamente o API future (Phase 3-4).

---

## 🎯 Gestione Set SAP

I **Set** sono definizioni dinamiche di gruppi di conti o centri di costo, gestiti in SAP.

### Set Class Disponibili

| Set Class | Descrizione | Struttura | Tipo KeyID |
|-----------|-------------|-----------|------------|
| **0109** | Conti (GL Accounts) | Flat | Numerico |
| **0101** | Centri di Costo (CDC) | Gerarchica | Alfanumerico |

### Esempi Set

```powershell
# Test connessione
Invoke-RestMethod -Uri "http://localhost:3000/api/sets/test"

# Ottieni set RICAVI (conti)
$ricavi = Invoke-RestMethod -Uri "http://localhost:3000/api/sets/0109/RICAVI"
$ricavi.values | Format-Table

# Ottieni set PRODUZIONE (CDC)
$prod = Invoke-RestMethod -Uri "http://localhost:3000/api/sets/0101/PRODUZIONE"
$prod.values | Format-Table
```

**Output Set RICAVI:**
```json
{
  "setclass": "0109",
  "setname": "RICAVI",
  "cache_hit": false,
  "total_values": 15,
  "values": [
    { "keyid": "0070001000", "description": "Ricavi vendite prodotti" },
    { "keyid": "0070002000", "description": "Ricavi prestazioni" }
    // ... altri conti
  ]
}
```

### Cache Set

I set sono cachati per **5 minuti** (configurabile in `.env`):

```powershell
# Statistiche cache
$stats = Invoke-RestMethod -Uri "http://localhost:3000/api/sets/cache/stats"
$stats | ConvertTo-Json -Depth 2

# Pulisci cache (forza rilettura da SAP)
Invoke-RestMethod -Uri "http://localhost:3000/api/sets/cache" -Method Delete
```

---

## 📚 Libreria Voci

La **Libreria Voci** (`config/voice_library.json`) contiene definizioni riutilizzabili di voci per i report.

**Posizione:** `config/voice_library.json` (file di configurazione)

**Ruolo:** Dizionario che definisce COME calcolare ogni voce. Quando un report richiede una voce (es. "CDV"), il sistema consulta questo file per sapere quale set SAP usare, che tipo di query eseguire, ecc.

### Tipi di Voci

#### 1. BASE_A: Solo Conti
Somma valori per un set di conti, senza filtro su CDC.

```json
{
  "id": "ricavi_totali",
  "name": "Ricavi Totali",
  "type": "BASE_A",
  "account_set": {
    "setclass": "0109",
    "setname": "RICAVI"
  },
  "sign": 1
}
```

**Query SQL Generata:**
```sql
SELECT SUM(amount) * 1
FROM sap_fi_data
WHERE fiscal_year = ? 
  AND account IN (valori_del_set_RICAVI)
```

#### 2. BASE_B: Conti + CDC
Somma valori per conti E centri di costo specifici.

```json
{
  "id": "costo_produzione",
  "name": "Costo Produzione",
  "type": "BASE_B",
  "account_set": {
    "setclass": "0109",
    "setname": "COSTI_DIRETTI"
  },
  "cost_center_set": {
    "setclass": "0101",
    "setname": "PRODUZIONE"
  },
  "sign": -1
}
```

**Query SQL Generata:**
```sql
SELECT SUM(amount) * -1
FROM sap_fi_data
WHERE fiscal_year = ? 
  AND account IN (valori_COSTI_DIRETTI)
  AND cost_center IN (valori_PRODUZIONE)
```

#### 3. CALCULATED: Formule
Voci calcolate da altre voci (con dipendenze).

```json
{
  "id": "margine_industriale",
  "name": "Margine Industriale",
  "type": "CALCULATED",
  "formula": "ricavi_totali - costo_produzione",
  "dependencies": ["ricavi_totali", "costo_produzione"]
}
```

**Esecuzione:** Calcola prima le dipendenze, poi esegue la formula.

### Categorie Voci

Le voci sono organizzate per categoria:

```json
{
  "voices": [
    {
      "category": "ricavi",
      "voices": [
        { "id": "ricavi_totali", ... },
        { "id": "ricavi_italia", ... }
      ]
    },
    {
      "category": "costi",
      "voices": [
        { "id": "costo_produzione", ... },
        { "id": "costo_commerciale", ... }
      ]
    },
    {
      "category": "margini",
      "voices": [
        { "id": "margine_industriale", ... },
        { "id": "ebitda", ... }
      ]
    }
  ]
}
```

### Modifica Voci

Edita direttamente `voice_library.json`:

```powershell
# Apri editor
code voice_library.json
```

**Non serve riavviare il server** - le voci verranno ricaricate al prossimo utilizzo.

---

## 📊 Configurazione Report

I **Report** (`reports/*.json`) combinano voci della libreria con parametri specifici.

### Esempio Report: Break Even

`reports/breakeven_semestre_2025.json`:

```json
{
  "metadata": {
    "report_id": "breakeven_s1_2025",
    "name": "Break Even Analysis - Semestre 1 2025",
    "description": "Analisi punto di pareggio primo semestre",
    "created_at": "2026-05-02",
    "author": "Finance Team"
  },
  "voice_library_ref": {
    "source": "voice_library.json",
    "version": "1.0"
  },
  "voices_used": [
    "ricavi_totali",
    "ricavi_italia",
    "ricavi_export",
    "costo_produzione",
    "margine_industriale",
    "ebitda"
  ],
  "execution_params": {
    "fiscal_year": 2025,
    "period_from": 1,
    "period_to": 6,
    "cost_centers": null
  },
  "layout": {
    "sections": [
      {
        "title": "Ricavi",
        "voices": ["ricavi_totali", "ricavi_italia", "ricavi_export"]
      },
      {
        "title": "Marginalità",
        "voices": ["margine_industriale", "ebitda"]
      }
    ]
  }
}
```

### Parametri Report

- **fiscal_year**: Anno di riferimento
- **period_from/to**: Range periodi (0-12)
- **cost_centers**: Filtro opzionale su CDC
- **voices_used**: Lista voci dalla libreria da calcolare
- **layout**: Organizzazione output (sezioni, ordine)

### Creare Nuovo Report

1. Copia template da `reports/breakeven_semestre_2025.json`
2. Modifica `metadata` (id, nome, descrizione)
3. Seleziona `voices_used` dalla libreria
4. Imposta `execution_params` (anno, periodi)
5. Definisci `layout` (sezioni, raggruppamenti)

**Il Report Executor (Phase 4) caricherà e eseguirà automaticamente questi file.**

---

## 💡 Esempi Pratici

### Scenario 1: Estrazione Dati Multi-Anno

```powershell
# 1. Modifica config/jobs.config.js
# yearFrom: 2020, yearTo: 2025

# 2. Riavvia server
# Ctrl+C nel terminale, poi npm start

# 3. Esegui estrazione
Invoke-RestMethod -Uri "http://localhost:3000/api/jobs/fi_monthly_extraction/run" -Method Post

# 4. Monitora log nel terminale
# Attendi completamento (~5-10 secondi per 6 anni)

# 5. Verifica dati
$stats = @{}
2020..2025 | ForEach-Object {
    $year = $_
    $result = Invoke-RestMethod -Uri "http://localhost:3000/api/data/fi?year=$year"
    $stats[$year] = $result.count
}
$stats
```

### Scenario 2: Analisi Account Specifico

```powershell
# Query dati account Clienti Italia
$account = "0014001010"
$result = Invoke-RestMethod -Uri "http://localhost:3000/api/data/fi?year=2025&account=$account"

# Calcola totale anno
$totale = ($result.data | Measure-Object -Property amount -Sum).Sum
Write-Host "Totale anno $account : $totale"

# Visualizza andamento mensile
$result.data | 
    Sort-Object fiscal_period | 
    Format-Table fiscal_period, amount -AutoSize
```

### Scenario 3: Verifica Set SAP

```powershell
# 1. Test connessione
Invoke-RestMethod -Uri "http://localhost:3000/api/sets/test"

# 2. Ottieni set RICAVI
$ricavi = Invoke-RestMethod -Uri "http://localhost:3000/api/sets/0109/RICAVI"
Write-Host "Set RICAVI: $($ricavi.total_values) conti"
$ricavi.values | Format-Table

# 3. Verifica cache
$cache = Invoke-RestMethod -Uri "http://localhost:3000/api/sets/cache/stats"
$cache | ConvertTo-Json

# 4. Pulisci cache e ricarica
Invoke-RestMethod -Uri "http://localhost:3000/api/sets/cache" -Method Delete
$ricavi2 = Invoke-RestMethod -Uri "http://localhost:3000/api/sets/0109/RICAVI"
# Nota: cache_hit sarà false nella risposta
```

### Scenario 4: Calcolo Manuale Voce BASE_A

```powershell
# Simula calcolo voce "ricavi_totali"
# (in attesa del Voice Executor automatico)

# 1. Ottieni set conti
$ricavi = Invoke-RestMethod -Uri "http://localhost:3000/api/sets/0109/RICAVI"
$accounts = $ricavi.values.keyid -join "','"

# 2. Query dati (simulazione - usa SQLite CLI o API futura)
# SELECT SUM(amount) FROM sap_fi_data 
# WHERE fiscal_year = 2025 
#   AND account IN ('$accounts')
#   AND fiscal_period BETWEEN 1 AND 12
```

### Scenario 5: Monitoraggio Job Schedulato

```powershell
# 1. Verifica configurazione job
$jobs = Invoke-RestMethod -Uri "http://localhost:3000/api/jobs"
$jobs | ConvertTo-Json -Depth 3

# 2. Stato job corrente
$status = Invoke-RestMethod -Uri "http://localhost:3000/api/jobs/fi_monthly_extraction/status"
$status | ConvertTo-Json

# 3. Log ultime estrazioni
$logs = Invoke-RestMethod -Uri "http://localhost:3000/api/logs?limit=5"
$logs | Format-Table start_time, status, records_inserted -AutoSize

# 4. Esecuzione manuale (se necessario)
Invoke-RestMethod -Uri "http://localhost:3000/api/jobs/fi_monthly_extraction/run" -Method Post
```

---

## 🔧 Troubleshooting

### Server Non Si Avvia

**Problema:** Errore all'avvio

```powershell
# Verifica porta 3000 libera
Test-NetConnection -ComputerName localhost -Port 3000

# Se occupata, identifica processo
Get-NetTCPConnection -LocalPort 3000 | Select-Object OwningProcess
Get-Process -Id <PROCESS_ID>

# Modifica porta in .env se necessario
# PORT=3001
```

### Errore Connessione SAP

**Problema:** `ECONNREFUSED` o timeout

```powershell
# 1. Verifica connettività rete SAP
Test-NetConnection -ComputerName sapr3prd.beltramesrl.local -Port 8030

# 2. Test URL SAP Set API
$url = "http://sapr3prd.beltramesrl.local:8030/sap/bc/ybreakeven/yset?setclass=0109&setname=RICAVI"
Invoke-RestMethod -Uri $url

# 3. Verifica credenziali in .env (se necessarie)
# SAP_USERNAME=...
# SAP_PASSWORD=...
```

### Database Locked

**Problema:** `SQLITE_BUSY: database is locked`

```powershell
# 1. Chiudi tutte le connessioni al DB
# Stop server: Ctrl+C

# 2. Verifica file WAL
Get-ChildItem ./data/*.db*

# 3. Se necessario, rimuovi file lock
Remove-Item ./data/*.db-wal -ErrorAction SilentlyContinue
Remove-Item ./data/*.db-shm -ErrorAction SilentlyContinue

# 4. Riavvia server
npm start
```

### Dati Duplicati

**Problema:** Estrazione eseguita due volte

```powershell
# Il sistema è append-only, non previene duplicati automaticamente
# Per pulire database e riestrarre:

# 1. Stop server
# Ctrl+C

# 2. Rimuovi database
Remove-Item ./data/sap_data.db*

# 3. Riavvia server (ricostruisce schema)
npm start

# 4. Riesegui estrazione
Invoke-RestMethod -Uri "http://localhost:3000/api/jobs/fi_monthly_extraction/run" -Method Post
```

### Set Non Trovato

**Problema:** `404 - Set non trovato`

```powershell
# 1. Verifica nome set in SAP (case-sensitive)
# Nomi corretti: RICAVI, COSTI_DIRETTI, PRODUZIONE (maiuscolo)

# 2. Verifica setclass
# 0109 per conti, 0101 per CDC

# 3. Test diretto su SAP
$url = "http://sapr3prd.beltramesrl.local:8030/sap/bc/ybreakeven/yset?setclass=0109&setname=RICAVI"
Invoke-RestMethod -Uri $url
```

### Performance Lente

**Problema:** Query lente su grandi volumi

```powershell
# 1. Verifica indici creati
# Log avvio server dovrebbe mostrare "10 indici creati"

# 2. Analizza query (se serve ottimizzazione futura)
# Indici disponibili:
# - idx_fi_year (fiscal_year)
# - idx_fi_account (account)
# - idx_fi_period (fiscal_period)
# - idx_fi_cost_center (cost_center)
# - idx_fi_year_account_period (composito)
# - idx_fi_year_cdc_period (composito)
# - idx_fi_year_account_cdc (composito)

# 3. Vacuum database (compatta)
# Richiede implementazione API futura
```

---

## 🚦 Prossimi Passi

### Phase 3: Voice Executor ✅ COMPLETATA

Esecuzione automatica delle voci dalla libreria con gestione dipendenze.

**API Endpoint:** `POST /api/voices/execute`

**Esempio Pratico - CDV 2025:**

```powershell
# Calcola Costo del Venduto anno 2025
$body = @{
  voice_ids = @("costo_venduto")
  fiscal_year = 2025
  period_from = 1
  period_to = 12
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/voices/execute" `
  -Method Post -Body $body -ContentType "application/json"
```

**Response:**
```json
{
  "success": true,
  "results": {
    "costo_venduto": 1243658.91
  },
  "execution_time": 16,
  "voices_executed": 1,
  "timestamp": "2026-05-02T17:08:49.473Z"
}
```

**Come Funziona:**
1. Legge definizione voce da `config/voice_library.json`
2. Fetcha set CDV da SAP API (33 conti)
3. Query SQLite con filtro anno/periodo/conti
4. Restituisce risultato aggregato

**Funzionalità Implementate:**
- ✅ Dependency graph builder (risoluzione dipendenze)
- ✅ Topological sort (ordine esecuzione)
- ✅ Query executor BASE_A (solo conti)
- ✅ Query executor BASE_B (conti + CDC)
- ✅ Formula evaluator CALCULATED (con eval sicuro)
- ✅ Gestione errori e validazione input

**Altri Endpoints:**
```powershell
# Lista tutte le voci disponibili
GET /api/voices/library

# Dettaglio singola voce
GET /api/voices/costo_venduto

# Ricarica libreria da file
POST /api/voices/reload
```

### Phase 4: Report Executor (Prossima)

Generazione automatica report da configurazione JSON.

**Struttura Report:**
```
reports/
  └── costo_venduto.json    ← Report che punta alle voci

config/
  └── voice_library.json    ← Definisce COME calcolare le voci
```

**Esempio Report (`reports/costo_venduto.json`):**
```json
{
  "report_metadata": {
    "id": "costo_venduto",
    "name": "Costo del Venduto",
    "description": "Report CDV - Totale costi diretti del venduto"
  },
  "voices_used": [
    "costo_venduto"
  ],
  "layout": {
    "format": "simple",
    "sections": [
      {
        "title": "Costo del Venduto",
        "voices": [
          {
            "voice_id": "costo_venduto",
            "label": "CDV Totale",
            "format": "currency"
          }
        ]
      }
    ]
  }
}
```

**Flusso Operativo:**
1. Utente richiede: `POST /api/reports/execute {"report_id": "costo_venduto"}`
2. Report dice: "ho bisogno della voce costo_venduto"
3. System va in `config/voice_library.json` per sapere COME calcolarla
4. Chiama Voice Executor per eseguire il calcolo
5. Formatta risultato secondo layout del report

Implementerà generazione automatica report da JSON:

```powershell
# API futura
POST /api/reports/execute
{
  "report_file": "breakeven_semestre_2025.json"
}

# Response (JSON, CSV o Excel)
{
  "report_id": "breakeven_s1_2025",
  "sections": [
    {
      "title": "Ricavi",
      "voices": {
        "ricavi_totali": 1500000.00,
        "ricavi_italia": 900000.00,
        "ricavi_export": 600000.00
      }
    }
  ],
  "generated_at": "2026-05-02T16:50:00Z"
}
```

**Funzionalità:**
- Caricamento voice_library.json
- Parsing configurazione report
- Esecuzione voci in ordine dipendenze
- Formatting output (JSON/CSV/Excel)
- Export multi-formato

---

## 📞 Supporto

Per assistenza o domande:

1. **Log Server:** Controlla sempre il terminale per errori dettagliati
2. **Health Check:** Verifica stato sistema con `/health`
3. **Test Connessioni:** Usa `/api/sets/test` per SAP
4. **Documentazione Codice:** Tutti i file hanno commenti JSDoc

---

## 🎯 Checklist Operativa Quotidiana

- [ ] Server avviato: `npm start`
- [ ] Health check OK: `GET /health`
- [ ] Connessione SAP OK: `GET /api/sets/test`
- [ ] Ultima estrazione riuscita: `GET /api/logs`
- [ ] Cache set aggiornata: `GET /api/sets/cache/stats`
- [ ] Dati anno corrente presenti: `GET /api/data/fi?year=2025`

---

**Versione:** 1.0 (Phase 1-2 Completate)  
**Ultimo Aggiornamento:** 2 Maggio 2026  
**Prossimo Sviluppo:** Voice Executor (Phase 3)
