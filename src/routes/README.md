# Routes & Controllers Architecture

Struttura pulita per separare **routing** e **business logic**.

---

## 📁 Struttura

```
src/
├── routes/                    # Definizione route (routing)
│   ├── index.js              # Aggregatore route
│   ├── health.routes.js      # Health check
│   ├── sets.routes.js        # SAP Set API routes
│   ├── jobs.routes.js        # Jobs & Logs routes
│   └── data.routes.js        # Data query routes
│
├── controllers/               # Business logic (handlers)
│   ├── sets.controller.js    # Logica Set API
│   ├── jobs.controller.js    # Logica Jobs
│   └── data.controller.js    # Logica Data queries
│
├── clients/                   # Client esterni (SAP, etc.)
├── storage/                   # Database clients
├── scheduler/                 # Job scheduling
├── processors/                # Transformers, validators
├── extractors/                # Data extractors
└── utils/                     # Utilities
```

---

## 🎯 Pattern Utilizzato

### **Routes** (src/routes/*.routes.js)

Responsabilità:
- Definire endpoint HTTP
- Montare middleware
- Chiamare controller appropriato

**Esempio** (`sets.routes.js`):
```javascript
import { Router } from 'express';
import SetsController from '../controllers/sets.controller.js';

function createSetsRoutes(setClient) {
  const router = Router();
  const controller = new SetsController(setClient);

  router.get('/test', (req, res) => controller.testConnection(req, res));
  router.get('/:setclass/:setname', (req, res) => controller.getSet(req, res));

  return router;
}

export default createSetsRoutes;
```

### **Controllers** (src/controllers/*.controller.js)

Responsabilità:
- Business logic
- Validazione input
- Chiamate a servizi/client
- Gestione errori
- Formattazione response

**Esempio** (`sets.controller.js`):
```javascript
import logger from '../utils/logger.js';

class SetsController {
  constructor(setClient) {
    this.setClient = setClient;
  }

  async getSet(req, res) {
    const { setclass, setname } = req.params;

    try {
      const result = await this.setClient.fetchSet(setclass, setname);
      res.json(result);
    } catch (error) {
      logger.error(`Errore recupero Set:`, error);
      res.status(500).json({ error: error.message });
    }
  }
}

export default SetsController;
```

---

## 🔌 Registrazione Route

Tutte le route sono registrate in `src/routes/index.js` (aggregatore):

```javascript
import registerRoutes from './src/routes/index.js';

// In index.js
registerRoutes(app, { dbClient, scheduler, setClient });
```

Monta automaticamente:
- `GET /health` → health.routes.js
- `/api/sets/*` → sets.routes.js
- `/api/jobs/*` → jobs.routes.js
- `/api/logs` → jobs.routes.js (logs separato)
- `/api/data/*` → data.routes.js

---

## 📋 Route Disponibili

### Health Check
- `GET /health` → Status applicazione

### SAP Set API
- `GET /api/sets/test` → Test connettività
- `GET /api/sets/:setclass/:setname` → Recupera Set
- `GET /api/sets/cache/stats` → Statistiche cache
- `DELETE /api/sets/cache` → Pulisci cache
- `DELETE /api/sets/cache/:setclass/:setname` → Pulisci Set specifico

### Jobs
- `GET /api/jobs` → Lista job
- `POST /api/jobs/:jobId/run` → Esegui job
- `GET /api/jobs/:jobId/status` → Status job

### Logs
- `GET /api/logs` → Ultimi log estrazioni
  - Query params: `?limit=50&status=success`

### Data Queries
- `GET /api/data/fi` → Query dati FI
  - Query params: `?year=2025&account=0038015430`

---

## ✅ Vantaggi Architettura

1. **Separazione Responsabilità**
   - Routes: solo routing
   - Controllers: solo business logic

2. **Testabilità**
   - Controller testabili indipendentemente
   - Mock facile delle dipendenze

3. **Manutenibilità**
   - Codice organizzato per dominio
   - Facile trovare logica specifica

4. **Riuso**
   - Controller riutilizzabili in più route
   - Logica centralizzata

5. **Scalabilità**
   - Facile aggiungere nuove route/controller
   - Struttura chiara per team

---

## 🔧 Come Aggiungere Nuova Funzionalità

### 1. Creare Controller

`src/controllers/reports.controller.js`:
```javascript
class ReportsController {
  constructor(dependencies) {
    this.voiceLibrary = dependencies.voiceLibrary;
  }

  async executeReport(req, res) {
    // Business logic
  }
}

export default ReportsController;
```

### 2. Creare Routes

`src/routes/reports.routes.js`:
```javascript
import { Router } from 'express';
import ReportsController from '../controllers/reports.controller.js';

function createReportsRoutes(dependencies) {
  const router = Router();
  const controller = new ReportsController(dependencies);

  router.post('/:id/execute', (req, res) => 
    controller.executeReport(req, res)
  );

  return router;
}

export default createReportsRoutes;
```

### 3. Registrare in Aggregatore

`src/routes/index.js`:
```javascript
import createReportsRoutes from './reports.routes.js';

function registerRoutes(app, dependencies) {
  // ... altre route
  app.use('/api/reports', createReportsRoutes(dependencies));
}
```

---

## 📝 Note

- **Dependency Injection**: Controller ricevono dipendenze via costruttore
- **Error Handling**: Sempre con try/catch e logger
- **Response Format**: JSON consistente
- **Status Codes**: HTTP standard (200, 404, 500, 503)

---

## 🔗 File Correlati

- [index.js](../../index.js) - Entry point pulito
- [SAP_EXTRACTOR_SPECS.md](../../SAP_EXTRACTOR_SPECS.md) - Architettura generale
- [FASE2_API_DOCUMENTATION.md](../../FASE2_API_DOCUMENTATION.md) - API Set documentation
