# SAP SQLite Extractor - Script Utilità
# Raccolta di comandi utili per gestire il sistema

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet('status', 'extract', 'query', 'sets', 'logs', 'clean', 'help')]
    [string]$Command = 'help',
    
    [Parameter(Mandatory=$false)]
    [int]$Year = 2025,
    
    [Parameter(Mandatory=$false)]
    [string]$Account = '',
    
    [Parameter(Mandatory=$false)]
    [string]$SetClass = '0109',
    
    [Parameter(Mandatory=$false)]
    [string]$SetName = 'RICAVI'
)

$BaseUrl = "http://localhost:3000"
$ErrorActionPreference = 'Stop'

function Show-Header {
    Write-Host ""
    Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host "   SAP SQLite Extractor - Utility Script" -ForegroundColor White
    Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host ""
}

function Test-ServerRunning {
    try {
        $null = Invoke-RestMethod -Uri "$BaseUrl/health" -TimeoutSec 2
        return $true
    } catch {
        Write-Host "❌ Server non raggiungibile su $BaseUrl" -ForegroundColor Red
        Write-Host "   Avvia il server con: npm start" -ForegroundColor Yellow
        return $false
    }
}

function Show-Status {
    Write-Host "📊 Stato Sistema" -ForegroundColor Green
    Write-Host "───────────────────────────────────────────────────────" -ForegroundColor Gray
    
    try {
        $health = Invoke-RestMethod -Uri "$BaseUrl/health"
        Write-Host "✅ Server:    " -NoNewline -ForegroundColor Green
        Write-Host "$($health.status.ToUpper())" -ForegroundColor White
        Write-Host "✅ Database:  " -NoNewline -ForegroundColor Green
        Write-Host "$($health.database)" -ForegroundColor White
        Write-Host "✅ Scheduler: " -NoNewline -ForegroundColor Green
        Write-Host "$($health.scheduler)" -ForegroundColor White
        
        # Conta record
        $data = Invoke-RestMethod -Uri "$BaseUrl/api/data/fi?year=$Year"
        Write-Host ""
        Write-Host "📁 Dati Anno $Year" -ForegroundColor Cyan
        Write-Host "   Record estratti: $($data.count)" -ForegroundColor White
        
        # Ultimi log
        $logs = Invoke-RestMethod -Uri "$BaseUrl/api/logs?limit=1"
        if ($logs.Count -gt 0) {
            Write-Host ""
            Write-Host "📝 Ultima Estrazione" -ForegroundColor Cyan
            $log = $logs[0]
            Write-Host "   Data:     $($log.start_time)" -ForegroundColor White
            Write-Host "   Status:   $($log.status)" -ForegroundColor White
            Write-Host "   Records:  $($log.records_inserted)" -ForegroundColor White
        }
        
    } catch {
        Write-Host "❌ Errore recupero stato: $($_.Exception.Message)" -ForegroundColor Red
    }
}

function Start-Extraction {
    Write-Host "🔄 Avvio Estrazione Dati SAP" -ForegroundColor Green
    Write-Host "───────────────────────────────────────────────────────" -ForegroundColor Gray
    
    try {
        Write-Host "⏳ Invio richiesta estrazione..." -ForegroundColor Yellow
        $result = Invoke-RestMethod -Uri "$BaseUrl/api/jobs/fi_monthly_extraction/run" -Method Post
        
        Write-Host "✅ Job avviato: $($result.message)" -ForegroundColor Green
        Write-Host ""
        Write-Host "⏳ Attendi completamento (circa 2-5 secondi)..." -ForegroundColor Yellow
        Start-Sleep -Seconds 3
        
        # Verifica risultato
        $data = Invoke-RestMethod -Uri "$BaseUrl/api/data/fi?year=$Year"
        Write-Host ""
        Write-Host "✅ Estrazione completata!" -ForegroundColor Green
        Write-Host "   Record anno $Year : $($data.count)" -ForegroundColor White
        
    } catch {
        Write-Host "❌ Errore estrazione: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "   Controlla i log del server nel terminale" -ForegroundColor Yellow
    }
}

function Show-QueryData {
    Write-Host "🔍 Query Dati Contabili" -ForegroundColor Green
    Write-Host "───────────────────────────────────────────────────────" -ForegroundColor Gray
    
    try {
        if ($Account) {
            $uri = "$BaseUrl/api/data/fi?year=$Year" + [char]38 + "account=$Account"
            Write-Host "📌 Filtri: Anno=$Year, Account=$Account" -ForegroundColor Cyan
        } else {
            $uri = "$BaseUrl/api/data/fi?year=$Year"
            Write-Host "📌 Filtri: Anno=$Year (tutti gli account)" -ForegroundColor Cyan
        }
        Write-Host ""
        
        $result = Invoke-RestMethod -Uri $uri
        Write-Host "📊 Totale record: $($result.count)" -ForegroundColor White
        Write-Host ""
        
        if ($result.count -gt 0) {
            if ($Account) {
                # Mostra dettaglio per account
                Write-Host "Dettaglio Account $Account :" -ForegroundColor Yellow
                $result.data | Sort-Object fiscal_period | Format-Table fiscal_period, amount -AutoSize
                
                $totale = ($result.data | Measure-Object -Property amount -Sum).Sum
                Write-Host "💰 Totale: $($totale.ToString('N2'))" -ForegroundColor Green
            } else {
                # Mostra campione
                Write-Host "Campione primi 10 record:" -ForegroundColor Yellow
                $result.data | Select-Object -First 10 | Format-Table fiscal_year, account, account_desc, fiscal_period, amount -AutoSize
            }
        }
        
    } catch {
        Write-Host "❌ Errore query: $($_.Exception.Message)" -ForegroundColor Red
    }
}

function Show-Sets {
    Write-Host "🎯 Gestione Set SAP" -ForegroundColor Green
    Write-Host "───────────────────────────────────────────────────────" -ForegroundColor Gray
    
    try {
        # Test connessione
        Write-Host "⏳ Test connessione SAP Set API..." -ForegroundColor Yellow
        $test = Invoke-RestMethod -Uri "$BaseUrl/api/sets/test"
        Write-Host "✅ Connessione OK: $($test.status)" -ForegroundColor Green
        Write-Host ""
        
        # Ottieni set
        Write-Host "📥 Caricamento Set: $SetClass / $SetName" -ForegroundColor Cyan
        $set = Invoke-RestMethod -Uri "$BaseUrl/api/sets/$SetClass/$SetName"
        
        Write-Host "✅ Set caricato: $($set.total_values) valori" -ForegroundColor Green
        Write-Host "   Cache Hit: $($set.cache_hit)" -ForegroundColor Gray
        Write-Host ""
        
        Write-Host "Valori:" -ForegroundColor Yellow
        $set.values | Format-Table keyid, description -AutoSize
        
        # Statistiche cache
        Write-Host ""
        Write-Host "📊 Statistiche Cache" -ForegroundColor Cyan
        $stats = Invoke-RestMethod -Uri "$BaseUrl/api/sets/cache/stats"
        $stats | ConvertTo-Json -Depth 2
        
    } catch {
        Write-Host "❌ Errore: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host ""
        Write-Host "💡 Esempi Set disponibili:" -ForegroundColor Yellow
        Write-Host "   0109 / RICAVI           (Conti ricavi)" -ForegroundColor Gray
        Write-Host "   0109 / COSTI_DIRETTI    (Conti costi)" -ForegroundColor Gray
        Write-Host "   0101 / PRODUZIONE       (CDC produzione)" -ForegroundColor Gray
    }
}

function Show-Logs {
    Write-Host "📝 Log Estrazioni" -ForegroundColor Green
    Write-Host "───────────────────────────────────────────────────────" -ForegroundColor Gray
    
    try {
        $logs = Invoke-RestMethod -Uri "$BaseUrl/api/logs?limit=10"
        
        if ($logs.Count -eq 0) {
            Write-Host "⚠️  Nessun log disponibile" -ForegroundColor Yellow
            return
        }
        
        Write-Host "Ultimi 10 log:" -ForegroundColor Cyan
        Write-Host ""
        $logs | Format-Table start_time, job_name, status, records_inserted, @{Label="Duration"; Expression={
            if ($_.end_time -and $_.start_time) {
                $start = [DateTime]::Parse($_.start_time)
                $end = [DateTime]::Parse($_.end_time)
                "$([Math]::Round(($end - $start).TotalSeconds, 2))s"
            } else {
                "N/A"
            }
        }} -AutoSize
        
    } catch {
        Write-Host "❌ Errore recupero log: $($_.Exception.Message)" -ForegroundColor Red
    }
}

function Clear-Database {
    Write-Host "⚠️  PULIZIA DATABASE" -ForegroundColor Red
    Write-Host "───────────────────────────────────────────────────────" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Questa operazione eliminerà TUTTI i dati estratti!" -ForegroundColor Yellow
    Write-Host ""
    
    $confirm = Read-Host "Sei sicuro? Digita 'SI' per confermare"
    
    if ($confirm -ne 'SI') {
        Write-Host "❌ Operazione annullata" -ForegroundColor Yellow
        return
    }
    
    Write-Host ""
    Write-Host "🛑 Stop server..." -ForegroundColor Yellow
    Write-Host "   (Premi Ctrl+C nel terminale del server)" -ForegroundColor Gray
    Write-Host ""
    Read-Host "Premi INVIO quando il server è stato fermato"
    
    Write-Host "🗑️  Eliminazione file database..." -ForegroundColor Yellow
    Remove-Item ./data/sap_data.db* -ErrorAction SilentlyContinue
    
    Write-Host "✅ Database eliminato" -ForegroundColor Green
    Write-Host ""
    Write-Host "💡 Prossimi passi:" -ForegroundColor Cyan
    Write-Host "   1. Riavvia il server: npm start" -ForegroundColor Gray
    Write-Host "   2. Riesegui estrazione: .\utility.ps1 extract" -ForegroundColor Gray
}

function Show-Help {
    Write-Host "📖 Comandi Disponibili" -ForegroundColor Green
    Write-Host "───────────────────────────────────────────────────────" -ForegroundColor Gray
    Write-Host ""
    
    Write-Host 'Usage: .\utility.ps1 -Command <comando> [parametri]' -ForegroundColor White
    Write-Host ""
    
    $commands = @(
        @{ Name="status"; Desc="Mostra stato sistema e dati" },
        @{ Name="extract"; Desc="Esegui estrazione dati SAP" },
        @{ Name="query"; Desc="Query dati contabili" },
        @{ Name="sets"; Desc="Gestione Set SAP" },
        @{ Name="logs"; Desc="Visualizza log estrazioni" },
        @{ Name="clean"; Desc="Pulisci database (ATTENZIONE!)" },
        @{ Name="help"; Desc="Mostra questa guida" }
    )
    
    Write-Host "Comandi:" -ForegroundColor Cyan
    foreach ($cmd in $commands) {
        Write-Host "  $($cmd.Name.PadRight(10)) " -NoNewline -ForegroundColor Yellow
        Write-Host "- $($cmd.Desc)" -ForegroundColor Gray
    }
    
    Write-Host ""
    Write-Host "Parametri:" -ForegroundColor Cyan
    Write-Host '  -Year <anno>          Anno di riferimento (default: 2025)' -ForegroundColor Gray
    Write-Host '  -Account <codice>     Filtra per account specifico' -ForegroundColor Gray
    Write-Host '  -SetClass <classe>    Classe set SAP (0109 o 0101)' -ForegroundColor Gray
    Write-Host '  -SetName <nome>       Nome set SAP' -ForegroundColor Gray
    
    Write-Host ""
    Write-Host "Esempi:" -ForegroundColor Cyan
    Write-Host "  .\utility.ps1 status" -ForegroundColor White
    Write-Host "  .\utility.ps1 extract" -ForegroundColor White
    Write-Host "  .\utility.ps1 query -Year 2025" -ForegroundColor White
    Write-Host "  .\utility.ps1 query -Year 2025 -Account 0014001010" -ForegroundColor White
    Write-Host "  .\utility.ps1 sets -SetClass 0109 -SetName RICAVI" -ForegroundColor White
    Write-Host "  .\utility.ps1 logs" -ForegroundColor White
    Write-Host ""
}

# Main Script
Show-Header

# Controlla server in esecuzione (eccetto per help e clean)
if ($Command -notin @('help', 'clean')) {
    if (-not (Test-ServerRunning)) {
        exit 1
    }
}

# Esegui comando
switch ($Command) {
    'status'  { Show-Status }
    'extract' { Start-Extraction }
    'query'   { Show-QueryData }
    'sets'    { Show-Sets }
    'logs'    { Show-Logs }
    'clean'   { Clear-Database }
    'help'    { Show-Help }
    default   { Show-Help }
}

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
