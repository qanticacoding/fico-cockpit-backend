# Scripts - SAP Data Extraction

Collezione di script di utilità per gestione database e estrazione dati SAP.

## 📥 Estrazione Dati SAP

### `extract-sap-data.js`

Script per estrarre dati contabili FI da SAP e importarli nel database specificando l'anno.

**Utilizzo:**

```bash
# Anno corrente (default)
npm run extract-sap

# Anno specifico
npm run extract-sap -- --year 2024

# Range di anni
npm run extract-sap -- --yearFrom 2023 --yearTo 2025

# Esecuzione diretta con Node
node scripts/extract-sap-data.js --year 2024
```

**Cosa fa:**

1. ✅ Si connette al database SQLite
2. ✅ Estrae dati da SAP per gli anni specificati
3. ✅ Trasforma i dati nel formato normalizzato
4. ✅ Valida i record
5. ✅ Inserisce i dati nel database
6. ✅ Mostra statistiche complete

**Output esempio:**

```
======================================================================
🚀 SAP FI Data Extraction Script
======================================================================
📅 Anno: 2024
======================================================================

📊 Connessione database...
✅ Database connesso

🔧 Inizializzazione estrattore FI...
✅ Estrattore pronto

📥 Estrazione dati da SAP...
   Endpoint: https://sap-api.example.com/fi_data
   Parametri: yearFrom=2024, yearTo=2024
✅ Estratti 1523 record da SAP in 2341ms

🔄 Trasformazione dati...
✅ Trasformati 18276 record normalizzati

✔️  Validazione dati...
✅ 18276 record validi pronti per inserimento

💾 Inserimento dati in database...
   Tabella: sap_fi_data
✅ Inseriti 18276 record in database

======================================================================
📊 RIEPILOGO ESTRAZIONE
======================================================================
✅ Record estratti da SAP:    1523
✅ Record normalizzati:       18276
✅ Record validi:             18276
✅ Record inseriti in DB:     18276
⏱️  Durata totale:             4.52s
======================================================================

📈 Verifica dati inseriti:
   Anno 2024: 18276 record

✅ Estrazione completata con successo!
```

**Casi d'uso:**

- 📦 Import dati storici di anni passati
- 🔄 Re-import dati di un anno specifico
- 🧪 Test con dati di diversi periodi
- 📊 Popolamento iniziale database

---

## 🗄️ Inizializzazione Database

### `init-database.js`

Inizializza schema del database SQLite (tabelle, indici, trigger).

```bash
npm run init-db
```

---

## 🎯 Gestione Voice Library

### `init-voice-database.js`

Inizializza database delle voci (configurazione report).

```bash
npm run init-voices
```

### `migrate-voices-json-to-db.js`

Migra voci da file JSON al database.

```bash
npm run migrate-voices
```

### Setup completo voci

```bash
npm run setup-voices
```

---

## 📋 Checklist Setup Completo

```bash
# 1. Inizializza database principale
npm run init-db

# 2. Setup voice library
npm run setup-voices

# 3. Estrai dati anno corrente
npm run extract-sap

# 4. Verifica (opzionale)
# Avvia server e controlla: GET /api/data/fi?year=2024
npm start
```

---

## 🔧 Variabili Ambiente Richieste

Assicurati di avere configurato nel file `.env`:

```env
# Database
SQLITE_PATH=./data/sap_data.db

# SAP API
SAP_BASE_URL=https://your-sap-server.com/api/fi_data
SAP_API_KEY=your_api_key

# Optional
SAP_TIMEOUT=30000
```

---

## ⚠️ Note

- Lo script `extract-sap-data.js` **inserisce** i dati (non sovrascrive)
- Per eliminare dati esistenti prima di re-importare:
  ```sql
  DELETE FROM sap_fi_data WHERE fiscal_year = 2024;
  ```
- I dati estratti includono automaticamente:
  - `extraction_date`: timestamp estrazione
  - `job_id`: identificativo univoco estrazione
