# 🚀 Migrazione Voice Library JSON → SQLite

## 📋 Cosa è Cambiato

La voice library è stata migrata da file JSON (`config/voice_library.json`) a database SQLite (`config/voice_config.db`).

### Vantaggi:
- ✅ Gestione CRUD tramite interfaccia web
- ✅ Audit log automatico (chi/quando ha modificato)
- ✅ Validazione constraint a livello DB
- ✅ Dropdown set SAP dinamici
- ✅ Separazione dati storici (sap_data.db) da configurazione (voice_config.db)

---

## 🔧 Setup Iniziale (Una Tantum)

### 1. Inizializza Database Voice Config
```powershell
npm run init-voices
```

Questo crea:
- `config/voice_config.db`
- Tabelle: `voices`, `voice_dependencies`, `voice_audit`
- Indici per performance

### 2. Migra Voci Esistenti da JSON
```powershell
npm run migrate-voices
```

Questo:
- Legge `config/voice_library.json`
- Popola il database SQLite
- Crea log audit per ogni voce

### 3. Elimina JSON (Opzionale)
```powershell
rm config/voice_library.json
```

---

## 🌐 Interfaccia Web Admin

### Accesso
```
http://localhost:3000/admin-voices.html
```

### Funzionalità:
- **Lista voci**: Visualizza tutte le voci con tipo, categoria, set
- **Crea voce**: Form guidato per BASE_A, BASE_B, CALCULATED
- **Modifica voce**: Aggiorna definizione esistente
- **Elimina voce**: Soft delete (non elimina fisicamente)
- **Validazione**: Impedisce eliminazione voci usate come dipendenze

---

## 📡 API REST

### Lista Voci
```powershell
GET /api/admin/voices
```

### Crea Voce BASE_A (solo conti)
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/admin/voices" -Method Post -ContentType "application/json" -Body @"
{
  "id": "ricavi_totali",
  "name": "Ricavi Totali",
  "type": "BASE_A",
  "account_setclass": "0109",
  "account_setname": "RICAVI",
  "category": "ricavi",
  "sign": 1
}
"@
```

### Crea Voce BASE_B (conti + filtro CDC)
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/admin/voices" -Method Post -ContentType "application/json" -Body @"
{
  "id": "cdv_produzione",
  "name": "CDV Produzione",
  "type": "BASE_B",
  "account_setclass": "0109",
  "account_setname": "CDV",
  "costcenter_setclass": "0101",
  "costcenter_setname": "PRD",
  "category": "costi",
  "sign": 1
}
"@
```

### Crea Voce CALCULATED (formula)
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/admin/voices" -Method Post -ContentType "application/json" -Body @"
{
  "id": "margine_lordo",
  "name": "Margine Lordo",
  "type": "CALCULATED",
  "formula": "ricavi_totali - costo_venduto_totale",
  "dependencies": ["ricavi_totali", "costo_venduto_totale"],
  "category": "margini",
  "sign": 1
}
"@
```

### Aggiorna Voce
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/admin/voices/ricavi_totali" -Method Put -ContentType "application/json" -Body @"
{
  "name": "Ricavi Totali Aggiornato",
  "type": "BASE_A",
  "account_setclass": "0109",
  "account_setname": "RICAVI",
  "category": "ricavi",
  "sign": 1
}
"@
```

### Elimina Voce
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/admin/voices/ricavi_totali" -Method Delete
```

### Audit History
```powershell
GET /api/admin/voices/:id/audit
```

---

## 🔄 Workflow Modifiche Voci

1. **Crea/Modifica via Web UI** → Salva in DB
2. **Voice Executor** → Legge automaticamente da DB (no restart necessario)
3. **Audit Log** → Traccia tutte le modifiche

---

## 📊 Schema Database

### Tabella `voices`
```sql
id                    TEXT PRIMARY KEY  -- 'costo_venduto_totale'
name                  TEXT NOT NULL
type                  TEXT NOT NULL     -- 'BASE_A' | 'BASE_B' | 'CALCULATED'
account_setclass      TEXT              -- '0109'
account_setname       TEXT              -- 'CDV'
costcenter_setclass   TEXT              -- '0101' (solo BASE_B)
costcenter_setname    TEXT              -- 'PRD' (solo BASE_B)
formula               TEXT              -- 'a + b + c' (solo CALCULATED)
sign                  INTEGER DEFAULT 1
category              TEXT
active                BOOLEAN DEFAULT 1
created_at            DATETIME
updated_at            DATETIME
```

### Tabella `voice_dependencies`
```sql
voice_id     TEXT  -- 'margine_lordo'
depends_on   TEXT  -- 'ricavi_totali'
```

### Tabella `voice_audit`
```sql
id           INTEGER PRIMARY KEY
voice_id     TEXT
action       TEXT              -- 'CREATE' | 'UPDATE' | 'DELETE'
changed_by   TEXT
changed_at   DATETIME
old_value    TEXT (JSON)
new_value    TEXT (JSON)
```

---

## ⚠️ Note Importanti

1. **Backup**: Prima di migrare, copia `voice_library.json` come backup
2. **Dipendenze**: Non puoi eliminare una voce usata da altre voci CALCULATED
3. **Validazione**: Il DB valida automaticamente i constraint (tipo, set obbligatori)
4. **Soft Delete**: L'eliminazione setta `active = 0` ma non cancella fisicamente

---

## 🐛 Troubleshooting

### Errore "UNIQUE constraint failed"
La voce con quell'ID esiste già. Usa PUT per aggiornare o scegli un altro ID.

### Errore "usata da X voci"
Non puoi eliminare una voce usata come dipendenza. Elimina prima le voci dipendenti.

### Errore "Set non valido"
Verifica che il set SAP esista con:
```powershell
GET /api/sets/0109/CDV
```

---

## 📚 Link Utili

- **Documentazione Completa**: `GUIDA_UTILIZZO.md`
- **Quick Reference**: `QUICK_REFERENCE.md`
- **Schema DB**: `config/voice-config.config.js`
