# Para todos os processos dev do Radar Chat v2 (backend + frontend Vite)
# Uso: powershell -File scripts/stop-dev.ps1

$ErrorActionPreference = 'SilentlyContinue'

function Stop-ListenersOnPort([int]$Port) {
  $seen = @{}
  $lines = netstat -ano | Select-String ":\s*$Port\s+.*LISTENING"
  foreach ($line in $lines) {
    $targetPid = ($line -split '\s+')[-1]
    if ($targetPid -match '^\d+$' -and $targetPid -ne '0' -and -not $seen.ContainsKey($targetPid)) {
      $seen[$targetPid] = $true
      Write-Host "Encerrando PID $targetPid (porta $Port)..."
      taskkill /F /PID $targetPid /T 2>$null | Out-Null
    }
  }
}

Write-Host "Parando Radar Chat v2 (portas 3001 e 5174)..."
Stop-ListenersOnPort 3001
Stop-ListenersOnPort 5174

# Qualquer Node do projeto radarchatv2 (evita 2x npm run dev)
Get-CimInstance Win32_Process -Filter "name='node.exe'" |
  Where-Object { $_.CommandLine -like '*radarchatv2*' } |
  ForEach-Object {
    Write-Host "Encerrando node radarchatv2 PID $($_.ProcessId)..."
    taskkill /F /PID $_.ProcessId /T 2>$null | Out-Null
  }

# ts-node-dev órfão (wrapper sem porta)
Get-CimInstance Win32_Process -Filter "name='node.exe'" |
  Where-Object { $_.CommandLine -like '*radarchatv2*ts-node-dev*' -or $_.CommandLine -like '*radarchatv2*wrap.js*' } |
  ForEach-Object {
    Write-Host "Encerrando backend órfão PID $($_.ProcessId)..."
    taskkill /F /PID $_.ProcessId /T 2>$null | Out-Null
  }

# Vite órfão
Get-CimInstance Win32_Process -Filter "name='node.exe'" |
  Where-Object { $_.CommandLine -like '*radarchatv2*vite*' } |
  ForEach-Object {
    Write-Host "Encerrando Vite órfão PID $($_.ProcessId)..."
    taskkill /F /PID $_.ProcessId /T 2>$null | Out-Null
  }

Start-Sleep -Seconds 1

# taskkill não chama graceful shutdown — libera lock dev no Redis
Write-Host "Liberando locks dev e WhatsApp no Redis..."
node scripts/clear-dev-lock.cjs 2>$null

Write-Host "`nPortas após limpeza:"
$listening = netstat -ano | Select-String "LISTENING" | Select-String ":3001 |:5174 "
if ($listening) { $listening } else { Write-Host "  3001 e 5174 livres." }
Write-Host "`nPronto. Agora pode executar: npm run dev"
