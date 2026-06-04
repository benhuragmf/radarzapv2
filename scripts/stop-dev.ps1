# Para todos os processos dev do RadarZap v2 (backend + frontend Vite)
# Uso: powershell -File scripts/stop-dev.ps1

$ErrorActionPreference = 'SilentlyContinue'

function Stop-ListenersOnPort([int]$Port) {
  $lines = netstat -ano | Select-String ":\s*$Port\s+.*LISTENING"
  foreach ($line in $lines) {
    $pid = ($line -split '\s+')[-1]
    if ($pid -match '^\d+$' -and $pid -ne '0') {
      Write-Host "Encerrando PID $pid (porta $Port)..."
      taskkill /F /PID $pid /T 2>$null | Out-Null
    }
  }
}

Write-Host "Parando RadarZap v2 (portas 3001 e 5174)..."
Stop-ListenersOnPort 3001
Stop-ListenersOnPort 5174

# Qualquer Node do projeto radarzapv2 (evita 2x npm run dev)
Get-CimInstance Win32_Process -Filter "name='node.exe'" |
  Where-Object { $_.CommandLine -like '*radarzapv2*' } |
  ForEach-Object {
    Write-Host "Encerrando node radarzapv2 PID $($_.ProcessId)..."
    taskkill /F /PID $_.ProcessId /T 2>$null | Out-Null
  }

# ts-node-dev órfão (wrapper sem porta)
Get-CimInstance Win32_Process -Filter "name='node.exe'" |
  Where-Object { $_.CommandLine -like '*radarzapv2*ts-node-dev*' -or $_.CommandLine -like '*radarzapv2*wrap.js*' } |
  ForEach-Object {
    Write-Host "Encerrando backend órfão PID $($_.ProcessId)..."
    taskkill /F /PID $_.ProcessId /T 2>$null | Out-Null
  }

# Vite órfão
Get-CimInstance Win32_Process -Filter "name='node.exe'" |
  Where-Object { $_.CommandLine -like '*radarzapv2*vite*' } |
  ForEach-Object {
    Write-Host "Encerrando Vite órfão PID $($_.ProcessId)..."
    taskkill /F /PID $_.ProcessId /T 2>$null | Out-Null
  }

Start-Sleep -Seconds 1
Write-Host "`nPortas após limpeza:"
netstat -ano | Select-String "LISTENING" | Select-String ":3001 |:5174 "
