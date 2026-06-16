# 🚀 Quick Reference - Comandi Più Usati

Riferimento rapido per operazioni quotidiane con SAP SQLite Extractor.

---

## 🎯 Operazioni Base

### Avvio Sistema

```powershell
# 1. Avvia server (nel terminale)
cd fico_cockpit_back
npm start

# 2. Tieni aperto il terminale per vedere i log
```

### Verifica Stato

```powershell
# Health check rapido
Invoke-RestMethod http://localhost:3000/health | ConvertTo-Json

# Stato completo con utility
.\utility.ps1 status
```

### Estrazione Dati

```powershell
# Estrazione manuale
.\utility.ps1 extract

# Oppure comando diretto
Invoke-RestMethod -Uri "http://localhost:3000/api/jobs/fi_monthly_extraction/run" -Method Post
```

---

## 📊 Query Dati Comuni

### Contare Record per Anno

```powershell
# Singolo anno
$result = Invoke-RestMethod "http://localhost:3000/api/data/fi?year=2025"
Write-Host "Anno 2025: $($result.count) record"

# Multi-anno con loop
2020..2025 | ForEach-Object {
    $result = Invoke-RestMethod "http://localhost:3000/api/data/fi?year=$_"
    Write-Host "Anno $_: $($result.count) record"
}
```

### Query Account Specifico

```powershell
# Metodo 1: Utility script
.\utility.ps1 query -Year 2025 -Account 0014001010

# Metodo 2: Comando diretto
$data = Invoke-RestMethod "http://localhost:3000/api/data/fi?year=2025&account=0014001010"
$data.data | Sort-Object fiscal_period | Format-Table fiscal_period, amount -AutoSize

# Calcola totale
$totale = ($data.data | Measure-Object -Property amount -Sum).Sum
Write-Host "Totale: $totale"
```

### Top 10 Account per Importo

```powershell
$data = Invoke-RestMethod "http://localhost:3000/api/data/fi?year=2025"
$data.data | 
    Group-Object account, account_desc | 
    ForEach-Object {
        [PSCustomObject]@{
            Account = $_.Group[0].account
            Descrizione = $_.Group[0].account_desc
            Totale = ($_.Group | Measure-Object -Property amount -Sum).Sum
        }
    } | 
    Sort-Object Totale -Descending | 
    Select-Object -First 10 | 
    Format-Table -AutoSize
```

### Analisi Periodo Specifico

```powershell
# Solo saldi iniziali (periodo 0)
$data = Invoke-RestMethod "http://localhost:3000/api/data/fi?year=2025"
$data.data | Where-Object { $_.fiscal_period -eq 0 } | Format-Table

# Solo movimenti primo trimestre (periodi 1-3)
$data.data | Where-Object { $_.fiscal_period -ge 1 -and $_.fiscal_period -le 3 } | Format-Table
```

---

## 🎯 Gestione Set SAP

### Verifica Set Esistente

```powershell
# Metodo 1: Utility
.\utility.ps1 sets -SetClass 0109 -SetName RICAVI

# Metodo 2: Diretto
$set = Invoke-RestMethod "http://localhost:3000/api/sets/0109/RICAVI"
Write-Host "Set RICAVI: $($set.total_values) conti"
$set.values | Format-Table keyid, description -AutoSize
```

### Pulire Cache Set

```powershell
# Forza ricaricamento da SAP
Invoke-RestMethod -Uri "http://localhost:3000/api/sets/cache" -Method Delete

# Verifica cache
Invoke-RestMethod "http://localhost:3000/api/sets/cache/stats" | ConvertTo-Json
```

### Elenco Set Comuni

```powershell
# Set Conti (0109)
$sets = @('RICAVI', 'COSTI_DIRETTI', 'AMMORTAMENTI')
foreach ($name in $sets) {
    $set = Invoke-RestMethod "http://localhost:3000/api/sets/0109/$name"
    Write-Host "$name : $($set.total_values) conti"
}

# Set CDC (0101)
$cdc = @('PRODUZIONE', 'COMMERCIALE', 'AMMINISTRAZIONE')
foreach ($name in $cdc) {
    $set = Invoke-RestMethod "http://localhost:3000/api/sets/0101/$name"
    Write-Host "$name : $($set.total_values) CDC"
}
```

---

## 📝 Monitoraggio e Log

### Ultimi Log Estrazioni

```powershell
# Con utility
.\utility.ps1 logs

# Diretto
$logs = Invoke-RestMethod "http://localhost:3000/api/logs?limit=10"
$logs | Format-Table start_time, status, records_inserted -AutoSize
```

### Monitoraggio Continuo

```powershell
# Loop che controlla ogni 30 secondi
while ($true) {
    Clear-Host
    Write-Host "=== Monitoraggio SAP Extractor ===" -ForegroundColor Cyan
    Write-Host "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
    Write-Host ""
    
    $health = Invoke-RestMethod "http://localhost:3000/health"
    Write-Host "Status: $($health.status) | DB: $($health.database)"
    
    $data = Invoke-RestMethod "http://localhost:3000/api/data/fi?year=2025"
    Write-Host "Record 2025: $($data.count)"
    
    Start-Sleep -Seconds 30
}
# Premi Ctrl+C per fermare
```

---

## 🔧 Troubleshooting Rapido

### Server Non Risponde

```powershell
# Verifica porta occupata
Test-NetConnection -ComputerName localhost -Port 3000

# Trova processo sulla porta
Get-NetTCPConnection -LocalPort 3000 | Select-Object OwningProcess
```

### Riavvio Completo

```powershell
# 1. Stop server (Ctrl+C nel terminale)
# 2. Rimuovi lock database
Remove-Item ./data/*.db-wal, ./data/*.db-shm -ErrorAction SilentlyContinue
# 3. Riavvia
npm start
```

### Reset Database Completo

```powershell
# ATTENZIONE: Elimina tutti i dati!
.\utility.ps1 clean

# Oppure manuale:
# 1. Stop server
# 2. Remove-Item ./data/sap_data.db*
# 3. npm start (ricostruisce schema)
# 4. .\utility.ps1 extract (riesegui estrazione)
```

### Test Connessione SAP

```powershell
# Test Set API
Invoke-RestMethod "http://localhost:3000/api/sets/test"

# Test diretto URL SAP
Test-NetConnection -ComputerName sapr3prd.beltramesrl.local -Port 8030

# Test API SAP diretta
$url = "http://sapr3prd.beltramesrl.local:8030/sap/bc/ybreakeven/yset?setclass=0109&setname=RICAVI"
Invoke-RestMethod $url
```

---

## 📊 Report e Analisi

### Export Dati in CSV

```powershell
# Esporta anno completo
$data = Invoke-RestMethod "http://localhost:3000/api/data/fi?year=2025"
$data.data | Export-Csv -Path "export_2025.csv" -NoTypeInformation -Encoding UTF8
Write-Host "✅ Esportati $($data.count) record in export_2025.csv"
```

### Confronto Multi-Anno

```powershell
# Confronta totali per account
$account = "0014001010"
$comparison = @()

2023..2025 | ForEach-Object {
    $year = $_
    $data = Invoke-RestMethod "http://localhost:3000/api/data/fi?year=$year&account=$account"
    $total = ($data.data | Measure-Object -Property amount -Sum).Sum
    
    $comparison += [PSCustomObject]@{
        Anno = $year
        Account = $account
        Totale = [Math]::Round($total, 2)
    }
}

$comparison | Format-Table -AutoSize
```

### Statistiche Database

```powershell
# Conta record per anno
$stats = @{}
2020..2025 | ForEach-Object {
    $result = Invoke-RestMethod "http://localhost:3000/api/data/fi?year=$_"
    $stats[$_] = $result.count
}

Write-Host ""
Write-Host "📊 Statistiche Database" -ForegroundColor Cyan
Write-Host "═══════════════════════════════" -ForegroundColor Gray
$stats.GetEnumerator() | Sort-Object Name | ForEach-Object {
    Write-Host "Anno $($_.Key): $($_.Value) record"
}
$total = ($stats.Values | Measure-Object -Sum).Sum
Write-Host "───────────────────────────────" -ForegroundColor Gray
Write-Host "Totale: $total record" -ForegroundColor Green
Write-Host ""
```

---

## 🚀 Workflow Tipico Giornaliero

```powershell
# 1. Avvia server
npm start

# 2. Verifica stato
.\utility.ps1 status

# 3. Se necessario, esegui estrazione
.\utility.ps1 extract

# 4. Query dati per analisi
.\utility.ps1 query -Year 2025 -Account 0014001010

# 5. Verifica set aggiornati
.\utility.ps1 sets -SetClass 0109 -SetName RICAVI

# 6. Controlla log
.\utility.ps1 logs
```

---

## 📖 Risorse

- **Guida Completa:** [GUIDA_UTILIZZO.md](./GUIDA_UTILIZZO.md)
- **Libreria Voci:** [voice_library.json](./voice_library.json)
- **Configurazione Report:** [reports/](./reports/)
- **Configurazione Sistema:** [config/](./config/)

---

## 💡 Tips & Tricks

### Alias PowerShell (Aggiungi a $PROFILE)

```powershell
# Crea alias per comandi frequenti
function sap-status { .\utility.ps1 status }
function sap-extract { .\utility.ps1 extract }
function sap-query { param($year, $account) .\utility.ps1 query -Year $year -Account $account }
function sap-logs { .\utility.ps1 logs }

# Usa così:
# sap-status
# sap-extract
# sap-query -year 2025 -account 0014001010
```

### Formato Output Personalizzato

```powershell
# Tabella compatta
$data.data | Format-Table account, fiscal_period, amount -AutoSize

# Lista dettagliata
$data.data | Format-List

# JSON leggibile
$data | ConvertTo-Json -Depth 3 | Out-File result.json
```

### Filtraggio Avanzato

```powershell
# Solo importi positivi
$data.data | Where-Object { $_.amount -gt 0 }

# Solo con CDC
$data.data | Where-Object { $_.cost_center -ne $null }

# Range di periodi
$data.data | Where-Object { $_.fiscal_period -ge 1 -and $_.fiscal_period -le 6 }
```

---

**Aggiornato:** 2 Maggio 2026  
**Versione:** 1.0
