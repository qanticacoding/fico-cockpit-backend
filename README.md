# 🚀 SAP SQLite Extractor

Sistema di estrazione e analisi dati SAP con architettura a 4 livelli: **dati storici** (SQLite), **set dinamici** (SAP API), **libreria voci** e **report configurabili**.

---

## ⚡ Quick Start (3 Comandi)

```powershell
# 1. Avvia server
npm start

# 2. Esegui estrazione
Invoke-RestMethod -Uri "http://localhost:3000/api/jobs/fi_monthly_extraction/run" -Method Post

# 3. Verifica dati
Invoke-RestMethod -Uri "http://localhost:3000/api/data/fi?year=2025" | Select-Object count
```

**Risultato:** 4911 record estratti da SAP, normalizzati e salvati in SQLite. ✅

---

## 📋 Stato del Progetto

| Phase | Stato | Descrizione |
|-------|-------|-------------|
| **Phase 1** | ✅ Completata | Estrazione dati SAP → SQLite (4911 record/anno) |
| **Phase 2** | ✅ Completata | Client Set SAP con cache (0109/0101) |
| **Phase 3** | ✅ Completata | Voice Executor (BASE_A, BASE_B, CALCULATED) - CDV validato |
| **Phase 4** | 🔜 Pianificata | Report Executor (JSON → Excel/CSV) |

---

## 🏗️ Architettura

```
┌─────────────────────────────────────────────────────┐
│ LAYER 4: REPORT (JSON Config)                      │
│ reports/costo_venduto.json                          │
└─────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────┐
│ LAYER 3: VOICE LIBRARY (Reusable) ✅               │
│ config/voice_library.json - voci riutilizzabili    │
│ POST /api/voices/execute - CDV: 1,243,658.91 €     │
└─────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────┐
│ LAYER 2: SAP SETS (Dynamic API)                    │
│ http://sapr3prd:8030/sap/bc/ybreakeven/yset        │
│ 0109: Conti | 0101: CDC | Cache: 5 min             │
└─────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────┐
│ LAYER 1: BASE DATA (Immutable)                     │
│ SQLite: ./data/sap_data.db                         │
│ 780 SAP records → 4911 normalized rows/year        │
└─────────────────────────────────────────────────────┘
```

**Principio Chiave:** Dati storici in DB, Set dinamici da API, Voci riutilizzabili ✅, Report configurabili 🔜.

---

## 📡 API Endpoints Principali

```powershell
# Health check
GET /health

# Esegui estrazione
POST /api/jobs/fi_monthly_extraction/run

# Query dati
GET /api/data/fi?year=2025&account=0014001010

# Ottieni set SAP
GET /api/sets/0109/CDV

# Esegui voci (NEW - Phase 3) ✅
POST /api/voices/execute
{
  "voice_ids": ["costo_venduto"],
  "fiscal_year": 2025,
  "period_from": 1,
  "period_to": 12
}

# Lista voci disponibili
GET /api/voices/library

# Log estrazioni
GET /api/logs?limit=10
```

---

## 📖 Documentazione

### Guide Utente

- **[GUIDA_UTILIZZO.md](./GUIDA_UTILIZZO.md)** - 📘 Guida completa dettagliata (10+ sezioni)
  - Architettura sistema
  - API endpoints
  - Gestione set SAP
  - Libreria voci e report
  - Esempi pratici
  - Troubleshooting

- **[QUICK_REFERENCE.md](./QUICK_REFERENCE.md)** - ⚡ Riferimento rapido
  - Comandi più usati
  - Query comuni
  - Workflow tipico
  - Tips & tricks

### Utility Script

```powershell
# Script PowerShell con menu interattivo
.\utility.ps1 -Command <comando>

# Comandi disponibili:
.\utility.ps1 status    # Stato sistema
.\utility.ps1 extract   # Esegui estrazione
.\utility.ps1 query     # Query dati
.\utility.ps1 sets      # Gestione set SAP
.\utility.ps1 logs      # Visualizza log
.\utility.ps1 clean     # Pulisci database
.\utility.ps1 help      # Guida comandi
```

### File Configurazione

| File | Descrizione |
|------|-------------|
| **voice_library.json** | Libreria voci riutilizzabili (13 voci) |
| **reports/breakeven_semestre_2025.json** | Esempio configurazione report |
| **config/jobs.config.js** | Job schedulati (anni, cron) |
| **config/sqlite.config.js** | Schema database e indici |
| **config/sap.config.js** | Endpoint SAP (FI data, Set API) |
| **.env** | Variabili ambiente (porte, URL SAP, cache) |

---

## 🛠️ Configurazione

### Modifica Anni da Estrarre

Edita `config/jobs.config.js`:

```javascript
params: {
  yearFrom: 2020,  // ← Modifica anno iniziale
  yearTo: 2025     // ← Modifica anno finale
}
```

Poi riavvia il server e riesegui l'estrazione.

### Modifica Schedule Automatico

Edita `config/jobs.config.js`:

```javascript
schedule: '0 2 1 * *',  // Primo giorno del mese alle 2:00
// Formato cron: minuto ora giorno mese giornoSettimana
```

### Configurazione Cache Set

Edita `.env`:

```bash
SAP_SET_CACHE_TTL=300000  # TTL cache in ms (default: 5 minuti)
```

---

## 📁 Struttura Progetto

```
fico_cockpit_back/
├── 📖 GUIDA_UTILIZZO.md        # Guida completa
├── ⚡ QUICK_REFERENCE.md       # Riferimento rapido
├── 🔧 utility.ps1              # Script utility PowerShell
│
├── config/                     # Configurazioni
│   ├── sap.config.js
│   ├── sqlite.config.js
│   └── jobs.config.js
│
├── src/
│   ├── routes/                # Routing HTTP
│   ├── controllers/           # Business logic
│   ├── extractors/            # Estrattori SAP custom
│   ├── processors/            # Trasformazioni dati
│   ├── storage/               # Gestione SQLite
│   ├── scheduler/             # Schedulazione job
│   ├── clients/               # Client esterni (SAP Set API)
│   └── utils/                 # Utilities
│
├── reports/                   # Configurazioni report JSON
│   └── breakeven_semestre_2025.json
│
├── voice_library.json         # Libreria voci riutilizzabili
│
├── data/                      # Database SQLite
│   └── sap_data.db
│
├── .env                       # Configurazione ambiente
└── package.json
├── .env.example      # Template configurazione
├── package.json
└── index.js         # Entry point
```

## ⚙️ Configurazione Job

I job sono configurati in `jobs/extraction-jobs.js`:

```javascript
{
  id: 'job_contabilita',
  name: 'Estrazione Contabilità Mensile',
  schedule: '0 2 1 * *',  // Ogni 1° del mese alle 02:00
  extractors: [
    {
      name: 'fi_extractor',
      targetTable: 'sap_fi_data',
      params: { yearFrom: 2025, yearTo: 2025 }
    }
  ],
  enabled: true
}
```

## 🗄️ Schema Database

Vedi `SAP_EXTRACTOR_SPECS.md` per il dettaglio completo degli schemi tabelle.

## 📊 API REST

Il server Express espone le seguenti API:

- `GET /health` - Health check
- `GET /jobs` - Lista job configurati
- `POST /jobs/:jobId/run` - Esegui job manualmente
- `GET /jobs/:jobId/status` - Status ultimo job
- `GET /logs` - Ultimi log estrazioni

## 🔧 Sviluppo

### Aggiungere un nuovo estrattore

1. Crea un file in `src/extractors/`
2. Estendi la classe `BaseExtractor`
3. Implementa il metodo `extract()`
4. Registra l'estrattore in `src/extractors/index.js`

### Aggiungere un nuovo job

1. Apri `jobs/extraction-jobs.js`
2. Aggiungi la configurazione del job
3. Riavvia il server

## 📝 Logging

I log sono salvati in:
- Console (stdout)
- File: `logs/app.log`
- Database: tabella `extraction_logs`

## 🔐 Sicurezza

- ⚠️ NON committare file `.env`
- ⚠️ NON committare file `.json` con dati SAP
- ⚠️ NON committare file `.db` (database SQLite)
- ✅ Usa variabili ambiente per credenziali
- ✅ Il `.gitignore` protegge i dati sensibili

## 🗺️ Roadmap

- [x] Fase 1: Estrazione dati SAP in SQLite
- [ ] Fase 2: Export report su AWS S3
- [ ] Fase 3: Query dirette su S3
- [ ] Fase 4: Dashboard visualizzazione

## 📚 Documentazione

Vedi `SAP_EXTRACTOR_SPECS.md` per la documentazione completa dell'architettura.

## 📧 Supporto

Per problemi o domande, consulta i log in `logs/app.log` e la tabella `extraction_logs` nel database.
