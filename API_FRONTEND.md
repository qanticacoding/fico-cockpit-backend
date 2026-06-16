# 📡 API Documentation - FICO Cockpit Backend

Documentazione completa delle API REST per sviluppatori frontend.

**Base URL:** `http://localhost:3000`  
**Formato Response:** JSON  
**Autenticazione:** Nessuna (TODO: implementare JWT in futuro)

---

## 📋 Indice

1. [Health Check](#1-health-check)
2. [Estrazione Dati SAP](#2-estrazione-dati-sap)
3. [Query Dati Storici](#3-query-dati-storici)
4. [Set SAP Dinamici](#4-set-sap-dinamici)
5. [Voice Library](#5-voice-library)
6. [Esecuzione Voci](#6-esecuzione-voci)
7. [Report](#7-report)
8. [Admin Voice Library](#8-admin-voice-library)
9. [Gestione Errori](#9-gestione-errori)

---

## 1. Health Check

### `GET /health`

Verifica lo stato del sistema e la connettività dei componenti.

**Response 200:**
```json
{
  "status": "ok",
  "timestamp": "2026-06-16T10:30:00.000Z",
  "database": "connected",
  "scheduler": "running",
  "setClient": "ready"
}
```

**Esempio cURL:**
```bash
curl http://localhost:3000/health
```

**Esempio JavaScript (fetch):**
```javascript
const response = await fetch('http://localhost:3000/health');
const data = await response.json();
console.log(data.status); // "ok"
```

---

## 2. Estrazione Dati SAP

### `POST /api/jobs/:jobId/run`

Esegue manualmente un job di estrazione dati da SAP.

**Parametri URL:**
- `jobId` (string): ID del job (es: `fi_monthly_extraction`)

**Response 200:**
```json
{
  "success": true,
  "message": "Job 'fi_monthly_extraction' avviato con successo",
  "jobId": "fi_monthly_extraction",
  "executionId": "exec_20260616_103045",
  "startedAt": "2026-06-16T10:30:45.123Z"
}
```

**Response 404:**
```json
{
  "error": "Job non trovato",
  "jobId": "invalid_job"
}
```

**Esempio JavaScript:**
```javascript
const response = await fetch('http://localhost:3000/api/jobs/fi_monthly_extraction/run', {
  method: 'POST'
});
const result = await response.json();
console.log(result.message);
```

### `GET /api/jobs/:jobId/status`

Ottiene lo stato di un job.

**Response 200:**
```json
{
  "jobId": "fi_monthly_extraction",
  "status": "running",
  "schedule": "0 2 1 * *",
  "lastExecution": {
    "startedAt": "2026-06-01T02:00:00.000Z",
    "completedAt": "2026-06-01T02:05:30.000Z",
    "status": "success",
    "recordsExtracted": 4911
  },
  "nextExecution": "2026-07-01T02:00:00.000Z"
}
```

### `GET /api/jobs`

Lista tutti i job configurati.

**Response 200:**
```json
{
  "jobs": [
    {
      "id": "fi_monthly_extraction",
      "name": "Estrazione Mensile FI",
      "schedule": "0 2 1 * *",
      "enabled": true,
      "lastRun": "2026-06-01T02:00:00.000Z"
    }
  ],
  "count": 1
}
```

### `GET /api/logs`

Ottiene il log delle estrazioni.

**Query Parameters:**
- `limit` (number, optional): Numero massimo di log (default: 50, max: 1000)
- `offset` (number, optional): Offset per paginazione (default: 0)
- `status` (string, optional): Filtra per stato (`success`, `error`, `running`)

**Response 200:**
```json
{
  "logs": [
    {
      "id": 1,
      "job_id": "fi_monthly_extraction",
      "status": "success",
      "records_extracted": 4911,
      "started_at": "2026-06-01T02:00:00.000Z",
      "completed_at": "2026-06-01T02:05:30.000Z",
      "message": "Estrazione completata con successo"
    }
  ],
  "pagination": {
    "limit": 50,
    "offset": 0,
    "total": 120
  }
}
```

**Esempio JavaScript:**
```javascript
// Ottieni ultimi 10 log
const response = await fetch('http://localhost:3000/api/logs?limit=10');
const data = await response.json();
data.logs.forEach(log => {
  console.log(`${log.job_id}: ${log.status} - ${log.records_extracted} records`);
});
```

---

## 3. Query Dati Storici

### `GET /api/data/fi`

Query sui dati contabili SAP FI memorizzati in SQLite.

**Query Parameters:**
- `year` (number, optional): Anno fiscale (es: 2025)
- `period` (number, optional): Periodo contabile (1-12)
- `account` (string, optional): Numero conto (es: "0014001010")
- `costCenter` (string, optional): Centro di costo (es: "P010101")
- `companyCode` (string, optional): Codice società (es: "0100")
- `limit` (number, optional): Numero massimo di record (default: 100, max: 10000)
- `offset` (number, optional): Offset per paginazione (default: 0)

**Response 200:**
```json
{
  "data": [
    {
      "id": 1,
      "fiscal_year": 2025,
      "period": 1,
      "account": "0014001010",
      "cost_center": "P010101",
      "company_code": "0100",
      "amount": 12500.50,
      "currency": "EUR",
      "document_number": "1900000123",
      "posting_date": "2025-01-15",
      "text": "Acquisto materiali"
    }
  ],
  "count": 1,
  "pagination": {
    "limit": 100,
    "offset": 0,
    "total": 4911
  }
}
```

**Esempi JavaScript:**

```javascript
// Query base: tutti i dati 2025
const response = await fetch('http://localhost:3000/api/data/fi?year=2025');
const data = await response.json();

// Query filtrata: conto specifico nel Q1 2025
const response = await fetch(
  'http://localhost:3000/api/data/fi?year=2025&account=0014001010&period=1'
);

// Query con paginazione
const response = await fetch(
  'http://localhost:3000/api/data/fi?year=2025&limit=50&offset=100'
);
```

---

## 4. Set SAP Dinamici

I Set SAP sono liste dinamiche di conti o centri di costo recuperate in real-time da SAP (NON memorizzate in DB).

### `GET /api/sets/:setclass/:setname`

Recupera i membri di un Set SAP.

**Parametri URL:**
- `setclass` (string): Classe del Set
  - `0109`: Set di conti
  - `0101`: Set di centri di costo
- `setname` (string): Nome del Set (es: `CDV`, `PRD`, `SG_A`)

**Response 200:**
```json
{
  "members": [
    "0038015430",
    "0038015431",
    "0038015435"
  ],
  "metadata": {
    "setclass": "0109",
    "setname": "CDV",
    "memberCount": 55,
    "isHierarchical": false,
    "hierarchyLevels": 1,
    "cached": true,
    "cacheExpiresAt": "2026-06-16T10:35:00.000Z"
  }
}
```

**Response 404:**
```json
{
  "error": "Set non trovato",
  "setclass": "0109",
  "setname": "INVALID"
}
```

**Esempi JavaScript:**

```javascript
// Ottieni Set CDV (Costi Del Venduto)
const response = await fetch('http://localhost:3000/api/sets/0109/CDV');
const data = await response.json();
console.log(`Set CDV contiene ${data.metadata.memberCount} conti`);

// Ottieni Set PRD (Centri di Costo Produzione)
const response = await fetch('http://localhost:3000/api/sets/0101/PRD');
const cdc = await response.json();
console.log('Centri di costo PRD:', cdc.members);
```

### `GET /api/sets/test`

Testa la connettività con l'API Set SAP.

**Response 200:**
```json
{
  "success": true,
  "message": "Connection OK - Retrieved 55 members",
  "setClass": "0109",
  "setName": "SG_A",
  "memberCount": 55
}
```

### `GET /api/sets/cache/stats`

Ottiene statistiche sulla cache dei Set.

**Response 200:**
```json
{
  "cacheEnabled": true,
  "cacheTTL": 300000,
  "totalCachedSets": 12,
  "cacheHitRate": 0.85,
  "sets": [
    {
      "key": "0109/CDV",
      "memberCount": 55,
      "cachedAt": "2026-06-16T10:30:00.000Z",
      "expiresAt": "2026-06-16T10:35:00.000Z"
    }
  ]
}
```

### `DELETE /api/sets/cache`

Pulisce completamente la cache dei Set.

**Response 200:**
```json
{
  "success": true,
  "message": "Cache pulita completamente",
  "setsRemoved": 12
}
```

### `DELETE /api/sets/cache/:setclass/:setname`

Pulisce un Set specifico dalla cache.

**Response 200:**
```json
{
  "success": true,
  "message": "Set 0109/CDV rimosso dalla cache"
}
```

---

## 5. Voice Library

La Voice Library contiene definizioni di voci riutilizzabili per calcoli finanziari.

### `GET /api/voices/library`

Lista tutte le voci disponibili nella libreria.

**Query Parameters:**
- `category` (string, optional): Filtra per categoria (`costi`, `ricavi`, `margini`)
- `type` (string, optional): Filtra per tipo (`BASE_A`, `BASE_B`, `CALCULATED`)

**Response 200:**
```json
{
  "voices": [
    {
      "id": "costi_beni_servizi_prd",
      "name": "Costi Beni e Servizi PRD",
      "description": "Costi diretti beni e servizi per la produzione",
      "type": "BASE_A",
      "category": "costi",
      "account_set": {
        "setclass": "0109",
        "setname": "CDV"
      },
      "sign": 1,
      "metadata": {
        "unit": "EUR",
        "format": "currency"
      }
    },
    {
      "id": "costo_lavoro_prd",
      "name": "Costo del Lavoro PRD",
      "description": "Costi del personale produttivo",
      "type": "BASE_B",
      "category": "costi",
      "account_set": {
        "setclass": "0109",
        "setname": "SG_A"
      },
      "cost_center_set": {
        "setclass": "0101",
        "setname": "PRD"
      },
      "sign": 1
    },
    {
      "id": "costo_venduto",
      "name": "Costo del Venduto",
      "description": "Somma di costi diretti e costo del lavoro",
      "type": "CALCULATED",
      "category": "costi",
      "formula": "costi_beni_servizi_prd + costo_lavoro_prd",
      "dependencies": [
        "costi_beni_servizi_prd",
        "costo_lavoro_prd"
      ]
    }
  ],
  "count": 13
}
```

### `GET /api/voices/library/:voiceId`

Ottiene i dettagli di una voce specifica.

**Response 200:**
```json
{
  "id": "costo_venduto",
  "name": "Costo del Venduto",
  "description": "Somma di costi diretti e costo del lavoro",
  "type": "CALCULATED",
  "category": "costi",
  "formula": "costi_beni_servizi_prd + costo_lavoro_prd",
  "dependencies": [
    "costi_beni_servizi_prd",
    "costo_lavoro_prd"
  ],
  "metadata": {
    "unit": "EUR",
    "format": "currency",
    "owner": "Finance Team",
    "created_at": "2026-05-02"
  }
}
```

**Response 404:**
```json
{
  "error": "Voce non trovata",
  "voiceId": "invalid_voice"
}
```

---

## 6. Esecuzione Voci

### `POST /api/voices/execute`

Esegue una o più voci dalla libreria calcolando i valori in base ai parametri forniti.

**Request Body:**
```json
{
  "voice_ids": ["costo_venduto"],
  "fiscal_year": 2025,
  "period_from": 1,
  "period_to": 12,
  "company_code": "0100"
}
```

**Parametri:**
- `voice_ids` (array[string], required): Lista di ID voci da eseguire
- `fiscal_year` (number, required): Anno fiscale
- `period_from` (number, required): Periodo iniziale (1-12)
- `period_to` (number, required): Periodo finale (1-12)
- `company_code` (string, optional): Codice società (default: "0100")

**Response 200:**
```json
{
  "success": true,
  "results": [
    {
      "voice_id": "costo_venduto",
      "voice_name": "Costo del Venduto",
      "type": "CALCULATED",
      "value": 1243658.91,
      "currency": "EUR",
      "details": {
        "fiscal_year": 2025,
        "period_from": 1,
        "period_to": 12,
        "company_code": "0100",
        "breakdown": [
          {
            "voice_id": "costi_beni_servizi_prd",
            "value": 850000.00
          },
          {
            "voice_id": "costo_lavoro_prd",
            "value": 393658.91
          }
        ]
      }
    }
  ],
  "execution_time_ms": 245
}
```

**Response 400 (Errore validazione):**
```json
{
  "error": "Parametri non validi",
  "details": [
    {
      "field": "fiscal_year",
      "message": "Anno fiscale obbligatorio"
    }
  ]
}
```

**Response 404 (Voce non trovata):**
```json
{
  "error": "Voce non trovata",
  "voice_id": "invalid_voice"
}
```

**Response 500 (Errore esecuzione):**
```json
{
  "error": "Errore durante l'esecuzione della voce",
  "voice_id": "costo_venduto",
  "details": "Dipendenza 'costo_lavoro_prd' non risolta"
}
```

**Esempi JavaScript:**

```javascript
// Esegui singola voce per anno completo 2025
const response = await fetch('http://localhost:3000/api/voices/execute', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    voice_ids: ['costo_venduto'],
    fiscal_year: 2025,
    period_from: 1,
    period_to: 12
  })
});
const result = await response.json();
console.log(`Costo del Venduto 2025: €${result.results[0].value.toLocaleString()}`);

// Esegui multiple voci per Q1 2025
const response = await fetch('http://localhost:3000/api/voices/execute', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    voice_ids: ['costi_beni_servizi_prd', 'costo_lavoro_prd', 'costo_venduto'],
    fiscal_year: 2025,
    period_from: 1,
    period_to: 3
  })
});
const result = await response.json();
result.results.forEach(voice => {
  console.log(`${voice.voice_name}: €${voice.value.toLocaleString()}`);
});
```

---

## 7. Report

### `POST /api/reports/execute`

Esegue un report configurabile definito in JSON.

**Request Body:**
```json
{
  "report_id": "breakeven_semestre_2025",
  "fiscal_year": 2025,
  "period_from": 1,
  "period_to": 6,
  "format": "json"
}
```

**Parametri:**
- `report_id` (string, required): ID del report da eseguire
- `fiscal_year` (number, required): Anno fiscale
- `period_from` (number, required): Periodo iniziale
- `period_to` (number, required): Periodo finale
- `format` (string, optional): Formato output (`json`, `csv`, `excel`) - default: `json`
- `company_code` (string, optional): Codice società

**Response 200 (format: json):**
```json
{
  "success": true,
  "report_id": "breakeven_semestre_2025",
  "report_name": "Break-Even Semestre 2025",
  "generated_at": "2026-06-16T10:30:00.000Z",
  "parameters": {
    "fiscal_year": 2025,
    "period_from": 1,
    "period_to": 6
  },
  "data": {
    "sections": [
      {
        "title": "Costi del Venduto",
        "voices": [
          {
            "id": "costi_beni_servizi_prd",
            "name": "Costi Beni e Servizi PRD",
            "value": 425000.00
          },
          {
            "id": "costo_lavoro_prd",
            "name": "Costo del Lavoro PRD",
            "value": 196829.45
          }
        ],
        "total": 621829.45
      }
    ],
    "grand_total": 621829.45
  },
  "execution_time_ms": 312
}
```

**Response 200 (format: csv):**
```
Content-Type: text/csv
Content-Disposition: attachment; filename="breakeven_semestre_2025.csv"

Sezione,Voce,Valore
"Costi del Venduto","Costi Beni e Servizi PRD",425000.00
"Costi del Venduto","Costo del Lavoro PRD",196829.45
```

**Response 404:**
```json
{
  "error": "Report non trovato",
  "report_id": "invalid_report"
}
```

### `GET /api/reports`

Lista tutti i report disponibili.

**Response 200:**
```json
{
  "reports": [
    {
      "id": "breakeven_semestre_2025",
      "name": "Break-Even Semestre 2025",
      "description": "Analisi break-even primo semestre 2025",
      "voices_count": 8,
      "created_at": "2026-05-02"
    }
  ],
  "count": 1
}
```

**Esempio JavaScript:**

```javascript
// Esegui report e scarica come CSV
const response = await fetch('http://localhost:3000/api/reports/execute', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    report_id: 'breakeven_semestre_2025',
    fiscal_year: 2025,
    period_from: 1,
    period_to: 6,
    format: 'csv'
  })
});

if (response.ok) {
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'report.csv';
  a.click();
}
```

---

## 8. Admin Voice Library

API per gestire la Voice Library (CRUD operations).

### `GET /api/admin/voices`

Lista tutte le voci con dettagli completi.

**Response 200:**
```json
{
  "voices": [...],
  "count": 13
}
```

### `POST /api/admin/voices`

Crea una nuova voce nella libreria.

**Request Body:**
```json
{
  "id": "nuova_voce",
  "name": "Nuova Voce",
  "description": "Descrizione della nuova voce",
  "type": "BASE_A",
  "category": "costi",
  "account_set": {
    "setclass": "0109",
    "setname": "CDV"
  },
  "sign": 1
}
```

**Response 201:**
```json
{
  "success": true,
  "message": "Voce creata con successo",
  "voice": {
    "id": "nuova_voce",
    "name": "Nuova Voce",
    ...
  }
}
```

**Response 400:**
```json
{
  "error": "Voce già esistente",
  "voice_id": "nuova_voce"
}
```

### `PUT /api/admin/voices/:voiceId`

Aggiorna una voce esistente.

**Request Body:**
```json
{
  "name": "Nome Aggiornato",
  "description": "Nuova descrizione"
}
```

**Response 200:**
```json
{
  "success": true,
  "message": "Voce aggiornata con successo",
  "voice": {...}
}
```

### `DELETE /api/admin/voices/:voiceId`

Elimina una voce dalla libreria.

**Response 200:**
```json
{
  "success": true,
  "message": "Voce eliminata con successo",
  "voice_id": "nuova_voce"
}
```

**Response 400:**
```json
{
  "error": "Impossibile eliminare la voce: è referenziata da altre voci",
  "referenced_by": ["costo_venduto"]
}
```

---

## 9. Gestione Errori

Tutte le API utilizzano codici HTTP standard e restituiscono errori in formato JSON consistente.

### Codici di Stato

| Codice | Significato | Quando |
|--------|-------------|--------|
| 200 | OK | Richiesta completata con successo |
| 201 | Created | Risorsa creata con successo |
| 400 | Bad Request | Parametri non validi o mancanti |
| 404 | Not Found | Risorsa non trovata |
| 500 | Internal Server Error | Errore del server |

### Formato Errore Standard

```json
{
  "error": "Messaggio di errore breve",
  "details": "Dettagli aggiuntivi sull'errore (opzionale)",
  "code": "ERROR_CODE",
  "timestamp": "2026-06-16T10:30:00.000Z"
}
```

### Esempi di Gestione Errori

**JavaScript con Fetch:**

```javascript
async function executeVoice(voiceIds, year, periodFrom, periodTo) {
  try {
    const response = await fetch('http://localhost:3000/api/voices/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        voice_ids: voiceIds,
        fiscal_year: year,
        period_from: periodFrom,
        period_to: periodTo
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Errore ${response.status}: ${error.error}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Errore esecuzione voce:', error.message);
    throw error;
  }
}
```

**JavaScript con Axios:**

```javascript
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3000',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' }
});

// Interceptor per gestione errori centralizzata
api.interceptors.response.use(
  response => response.data,
  error => {
    if (error.response) {
      // Server ha risposto con status code fuori dal range 2xx
      console.error(`Errore API ${error.response.status}:`, error.response.data.error);
    } else if (error.request) {
      // Richiesta inviata ma nessuna risposta ricevuta
      console.error('Nessuna risposta dal server');
    } else {
      // Errore durante la configurazione della richiesta
      console.error('Errore:', error.message);
    }
    return Promise.reject(error);
  }
);

// Uso
try {
  const result = await api.post('/api/voices/execute', {
    voice_ids: ['costo_venduto'],
    fiscal_year: 2025,
    period_from: 1,
    period_to: 12
  });
  console.log('Risultato:', result);
} catch (error) {
  // Gestione errore già loggata dall'interceptor
}
```

---

## 📚 Risorse Aggiuntive

### Esempio Completo: Dashboard Costi

```javascript
// Dashboard React Component Example
import { useState, useEffect } from 'react';

function CostDashboard() {
  const [costs, setCosts] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCosts();
  }, []);

  async function fetchCosts() {
    try {
      setLoading(true);
      
      // Esegui voci per calcolare costi
      const response = await fetch('http://localhost:3000/api/voices/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voice_ids: ['costi_beni_servizi_prd', 'costo_lavoro_prd', 'costo_venduto'],
          fiscal_year: 2025,
          period_from: 1,
          period_to: 12
        })
      });

      if (!response.ok) throw new Error('Errore caricamento dati');

      const data = await response.json();
      setCosts(data.results);
    } catch (error) {
      console.error('Errore:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div>Caricamento...</div>;

  return (
    <div className="dashboard">
      <h1>Dashboard Costi 2025</h1>
      {costs?.map(voice => (
        <div key={voice.voice_id} className="cost-card">
          <h3>{voice.voice_name}</h3>
          <p className="amount">€ {voice.value.toLocaleString('it-IT')}</p>
          {voice.details?.breakdown && (
            <ul>
              {voice.details.breakdown.map(item => (
                <li key={item.voice_id}>
                  {item.voice_id}: € {item.value.toLocaleString('it-IT')}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}
```

### TypeScript Types

```typescript
// types/api.ts

export interface HealthResponse {
  status: 'ok' | 'error';
  timestamp: string;
  database: 'connected' | 'disconnected';
  scheduler: 'running' | 'stopped';
  setClient: 'ready' | 'error';
}

export interface Voice {
  id: string;
  name: string;
  description: string;
  type: 'BASE_A' | 'BASE_B' | 'CALCULATED';
  category: string;
  account_set?: {
    setclass: string;
    setname: string;
  };
  cost_center_set?: {
    setclass: string;
    setname: string;
  };
  formula?: string;
  dependencies?: string[];
  sign?: number;
  metadata?: {
    unit: string;
    format: string;
    owner?: string;
    created_at?: string;
  };
}

export interface VoiceExecutionParams {
  voice_ids: string[];
  fiscal_year: number;
  period_from: number;
  period_to: number;
  company_code?: string;
}

export interface VoiceExecutionResult {
  voice_id: string;
  voice_name: string;
  type: string;
  value: number;
  currency: string;
  details: {
    fiscal_year: number;
    period_from: number;
    period_to: number;
    company_code: string;
    breakdown?: Array<{
      voice_id: string;
      value: number;
    }>;
  };
}

export interface VoiceExecutionResponse {
  success: boolean;
  results: VoiceExecutionResult[];
  execution_time_ms: number;
}

export interface FIDataRecord {
  id: number;
  fiscal_year: number;
  period: number;
  account: string;
  cost_center: string;
  company_code: string;
  amount: number;
  currency: string;
  document_number: string;
  posting_date: string;
  text: string;
}

export interface FIDataResponse {
  data: FIDataRecord[];
  count: number;
  pagination: {
    limit: number;
    offset: number;
    total: number;
  };
}

export interface SapSet {
  members: string[];
  metadata: {
    setclass: string;
    setname: string;
    memberCount: number;
    isHierarchical: boolean;
    hierarchyLevels: number;
    cached: boolean;
    cacheExpiresAt?: string;
  };
}

export interface ApiError {
  error: string;
  details?: string;
  code?: string;
  timestamp?: string;
}
```

---

## 🔧 Configurazione Client

### Variabili Ambiente Consigliate

```javascript
// .env.local (frontend)
VITE_API_BASE_URL=http://localhost:3000
VITE_API_TIMEOUT=30000
VITE_ENABLE_REQUEST_LOGGING=true
```

### Helper API Client

```javascript
// utils/apiClient.js
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
const API_TIMEOUT = import.meta.env.VITE_API_TIMEOUT || 30000;

class ApiClient {
  constructor(baseURL = API_BASE_URL) {
    this.baseURL = baseURL;
    this.timeout = API_TIMEOUT;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...config,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      throw error;
    }
  }

  get(endpoint, params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const url = queryString ? `${endpoint}?${queryString}` : endpoint;
    return this.request(url, { method: 'GET' });
  }

  post(endpoint, data) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  put(endpoint, data) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }
}

export default new ApiClient();
```

**Utilizzo:**

```javascript
import api from './utils/apiClient';

// Health check
const health = await api.get('/health');

// Query dati
const data = await api.get('/api/data/fi', { year: 2025, limit: 100 });

// Esegui voce
const result = await api.post('/api/voices/execute', {
  voice_ids: ['costo_venduto'],
  fiscal_year: 2025,
  period_from: 1,
  period_to: 12
});
```

---

## 📞 Supporto

Per domande o problemi:
- Verifica lo stato del sistema: `GET /health`
- Consulta i log delle estrazioni: `GET /api/logs`
- Contatta il team backend

**Versione API:** 1.0.0  
**Ultimo aggiornamento:** 2026-06-16
