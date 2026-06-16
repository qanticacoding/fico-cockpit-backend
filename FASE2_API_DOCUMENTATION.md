# Fase 2: SAP Set Client - API Documentation

## ✅ Implementazione Completata

Sistema per leggere **Set SAP dinamicamente** tramite API (real-time, NON memorizzati in database).

---

## 🎯 Architettura

### Componenti Implementati:

1. **SAP Set Client** (`src/clients/sap-set-client.js`)
   - Chiamate HTTP a `/sap/bc/ybreakeven/yset`
   - Cache in-memory con TTL configurabile (default: 5 minuti)
   - Parsing automatico membri Set
   - Statistiche e monitoring

2. **API REST Endpoints** (in `index.js`)
   - `GET /api/sets/test` - Test connettività
   - `GET /api/sets/:setclass/:setname` - Recupera Set
   - `GET /api/sets/cache/stats` - Statistiche cache
   - `DELETE /api/sets/cache` - Pulisci cache completa
   - `DELETE /api/sets/cache/:setclass/:setname` - Pulisci Set specifico

3. **Configurazione** (`.env`)
   - `SAP_SET_API_PATH` - Path API Set
   - `SAP_SET_TIMEOUT` - Timeout chiamate (ms)
   - `ENABLE_SET_CACHE` - Abilita cache (true/false)
   - `SET_CACHE_TTL` - TTL cache (ms, default: 300000 = 5 min)

---

## 🚀 Test e Utilizzo

### 1. Avvia il Server

```powershell
npm start
```

### 2. Test Connettività SAP

```powershell
# Test con Set predefinito (SG_A)
Invoke-WebRequest -Uri "http://localhost:3000/api/sets/test" | Select-Object -ExpandProperty Content | ConvertFrom-Json | ConvertTo-Json -Depth 10
```

**Response attesa:**
```json
{
  "success": true,
  "message": "Connection OK - Retrieved 55 members",
  "setClass": "0109",
  "setName": "SG_A",
  "memberCount": 55
}
```

### 3. Recupera Set Conti (0109)

```powershell
# Esempio: Set SG_A (Sales, General & Administration)
Invoke-WebRequest -Uri "http://localhost:3000/api/sets/0109/SG_A" | Select-Object -ExpandProperty Content | ConvertFrom-Json | ConvertTo-Json -Depth 10
```

**Response:**
```json
{
  "members": [
    "0038015430",
    "0038015431",
    ...
  ],
  "metadata": {
    "setclass": "0109",
    "setname": "SG_A",
    "memberCount": 55,
    "isHierarchical": false,
    "hierarchyLevels": 1,
    "fetchedAt": "2025-04-20T10:30:00.000Z"
  },
  "cached": false
}
```

### 4. Recupera Set Cost Centers (0101)

```powershell
# Esempio: Set PRD (Produzione)
Invoke-WebRequest -Uri "http://localhost:3000/api/sets/0101/PRD" | Select-Object -ExpandProperty Content | ConvertFrom-Json | ConvertTo-Json -Depth 10
```

**Response:**
```json
{
  "members": [
    "P_PSCROBO1",
    "ACQUMM",
    "P_SAGOMA01",
    ...
  ],
  "metadata": {
    "setclass": "0101",
    "setname": "PRD",
    "memberCount": 21,
    "isHierarchical": true,
    "hierarchyLevels": 4,
    "fetchedAt": "2025-04-20T10:31:00.000Z"
  },
  "rawHierarchy": [
    { "hierlevel": 0, "node": "PRD" },
    { "hierlevel": 1, "node": "MOD" },
    ...
  ],
  "cached": false
}
```

### 5. Verifica Cache

```powershell
# Statistiche cache
Invoke-WebRequest -Uri "http://localhost:3000/api/sets/cache/stats" | Select-Object -ExpandProperty Content | ConvertFrom-Json | ConvertTo-Json -Depth 10
```

**Response:**
```json
{
  "enabled": true,
  "ttl": 300000,
  "size": 2,
  "stats": {
    "totalCalls": 10,
    "hits": 3,
    "misses": 7,
    "errors": 0,
    "hitRate": "30.00%"
  },
  "entries": [
    {
      "key": "0109:SG_A",
      "age": 45000,
      "memberCount": 55,
      "expiresIn": 255000
    },
    {
      "key": "0101:PRD",
      "age": 30000,
      "memberCount": 21,
      "expiresIn": 270000
    }
  ]
}
```

### 6. Pulisci Cache

```powershell
# Pulisci tutta la cache
Invoke-RestMethod -Method Delete -Uri "http://localhost:3000/api/sets/cache"

# Pulisci solo un Set
Invoke-RestMethod -Method Delete -Uri "http://localhost:3000/api/sets/cache/0109/SG_A"
```

---

## 📊 Set Classes Disponibili

### 0109 - GL Accounts (Conti)

Struttura **flat** (non gerarchica):
- Membri: Account numbers (es. `0038015430`)
- Uso: Filtri query su `account` field in `sap_fi_data`

**Esempi Set:**
- `SG_A` - Sales, General & Administration
- `CDV` - Costo Del Venduto base
- `CDV_SGA` - CDV con allocazioni SG&A
- `AMM` - Ammortamenti
- `RICAVI` - Ricavi totali
- `COSTI_FISSI` - Costi operativi fissi

### 0101 - Cost Centers (CDC)

Struttura **gerarchica** (4 livelli):
- Membri: Cost center codes (es. `P_PSCROBO1`, `ACQUMM`)
- Uso: Filtri query su `cost_center` field in `sap_fi_data`

**Esempi Set:**
- `PRD` - Produzione (21 CDC, 4 livelli)
- `VEN` - Vendite
- `AMM` - Amministrazione

---

## 🔧 Configurazione Avanzata

### Disabilita Cache (per testing)

```env
# Nel file .env
ENABLE_SET_CACHE=false
```

### Aumenta TTL Cache

```env
# 10 minuti invece di 5
SET_CACHE_TTL=600000
```

### Timeout API più lungo

```env
# 30 secondi invece di 15
SAP_SET_TIMEOUT=30000
```

---

## 🧪 Testing Completo

```powershell
# 1. Test connettività
$test = Invoke-RestMethod -Uri "http://localhost:3000/api/sets/test"
Write-Host "Test: $($test.success)" -ForegroundColor Green

# 2. Recupera Set Conti
$setConti = Invoke-RestMethod -Uri "http://localhost:3000/api/sets/0109/SG_A"
Write-Host "Set Conti: $($setConti.metadata.memberCount) membri" -ForegroundColor Cyan

# 3. Recupera Set CDC
$setCdc = Invoke-RestMethod -Uri "http://localhost:3000/api/sets/0101/PRD"
Write-Host "Set CDC: $($setCdc.metadata.memberCount) membri, hierarchical: $($setCdc.metadata.isHierarchical)" -ForegroundColor Cyan

# 4. Verifica cache (seconda chiamata dovrebbe essere cached=true)
$cached = Invoke-RestMethod -Uri "http://localhost:3000/api/sets/0109/SG_A"
Write-Host "Cached: $($cached.cached)" -ForegroundColor Yellow

# 5. Statistiche
$stats = Invoke-RestMethod -Uri "http://localhost:3000/api/sets/cache/stats"
Write-Host "Cache Hit Rate: $($stats.stats.hitRate)" -ForegroundColor Magenta
```

---

## ❌ Troubleshooting

### Errore "Set Client non disponibile"

**Causa:** Server non inizializzato correttamente

**Soluzione:**
```powershell
# Riavvia server
npm start
```

### Errore "Failed to fetch SAP Set"

**Causa:** SAP API non raggiungibile o Set non esistente

**Verifica:**
1. URL SAP corretto in `.env`
2. Nome Set valido (prova con `SG_A` o `PRD`)
3. Connessione rete a SAP

```powershell
# Test diretto API SAP
Invoke-WebRequest -Uri "http://sapr3prd.beltramesrl.local:8030/sap/bc/ybreakeven/yset?setclass=0109&setname=SG_A"
```

### Cache non funziona

**Verifica configurazione:**
```powershell
# Controlla .env
Get-Content .env | Select-String -Pattern "CACHE"
```

Deve contenere:
```
ENABLE_SET_CACHE=true
SET_CACHE_TTL=300000
```

---

## 📝 Logs

Controlla logs in `./logs/app.log`:

```powershell
Get-Content ./logs/app.log -Tail 50 -Wait
```

Cerca righe con `[SET CLIENT]`:
```
[2025-04-20T10:30:00.000Z] [INFO] [SET CLIENT] Fetching Set: 0109/SG_A
[2025-04-20T10:30:01.000Z] [INFO] [SET CLIENT] Parsed Set 0109/SG_A: 55 members, hierarchical: false
[2025-04-20T10:30:01.000Z] [DEBUG] [SET CLIENT] Cached: 0109:SG_A (55 members, TTL: 300000ms)
```

---

## ✅ Fase 2 - Status

- [x] SAP Set Client implementato
- [x] Cache in-memory con TTL
- [x] API REST endpoints
- [x] Parsing Set 0109 (Conti)
- [x] Parsing Set 0101 (CDC) con gerarchia
- [x] Test connectivity
- [x] Statistiche e monitoring
- [x] Configurazione .env
- [x] ES Modules completo
- [x] Documentazione API

**Pronto per Fase 3:** Sistema Voci Report 🎯

---

## 🔗 Prossimo Step

Fase 3 implementerà:
- Voice Executor BASE_A (usa Set Client + SQLite)
- Voice Executor BASE_B (usa 2 Set Clients + SQLite)
- Voice Executor CALCULATED (formule)
- Dependency Graph e Topological Sort
