# Migracao unica: copia discord-whatsapp do volume v1 para volumes nativos radarchatv2.
# Nao monta volumes v1 no docker-compose - so le uma vez via container temporario.
# Uso: npm run migrate:v1-db

$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot

$V1Volume = "radarchat_mongodb-data"
$V2Volume = "radarchatv2_mongodb-data"
$DumpDir = Join-Path $ProjectRoot "tmp\mongo-dump-v1"
$ExportContainer = "radarchatv2-mongo-v1-export"
$V1Port = 27018

function Load-DotEnv {
    param([string]$Path)
    if (-not (Test-Path $Path)) { return @{} }
    $vars = @{}
    Get-Content $Path | ForEach-Object {
        if ($_ -match '^\s*([^#=]+)=(.*)$') {
            $vars[$matches[1].Trim()] = $matches[2].Trim()
        }
    }
    return $vars
}

function Run-Docker {
    param(
        [switch]$AllowFailure,
        [Parameter(Mandatory = $true)][string[]]$Command
    )
    $output = & docker @Command 2>&1
    if ($output) { $output | ForEach-Object { Write-Host $_ } }
    if ($LASTEXITCODE -ne 0 -and -not $AllowFailure) {
        throw "docker $($Command -join ' ') falhou (exit $LASTEXITCODE)"
    }
}

$envVars = Load-DotEnv (Join-Path $ProjectRoot ".env")
$mongoPassword = $envVars["MONGO_PASSWORD"]
if (-not $mongoPassword) {
    throw "MONGO_PASSWORD ausente no .env"
}

Write-Host "==> Parando stack v2 (se estiver rodando)..."
Run-Docker -Command @('compose', 'down')

Write-Host "==> Exportando banco do volume v1 ($V1Volume) [somente leitura]..."
Run-Docker -AllowFailure -Command @('rm', '-f', $ExportContainer)
Run-Docker -Command @(
    'run', '-d', '--name', $ExportContainer,
    '-v', "${V1Volume}:/data/db",
    '-p', "${V1Port}:27017",
    'mongo:7', 'mongod', '--bind_ip_all'
)

Start-Sleep -Seconds 4

New-Item -ItemType Directory -Force -Path $DumpDir | Out-Null
Run-Docker -Command @('exec', $ExportContainer, 'mongodump', '--db', 'discord-whatsapp', '--out', '/tmp/dump')
Run-Docker -Command @('cp', "${ExportContainer}:/tmp/dump/discord-whatsapp", $DumpDir)

$bsonFiles = @(Get-ChildItem -Path $DumpDir -Filter "*.bson" -Recurse -ErrorAction SilentlyContinue)
if ($bsonFiles.Count -eq 0) {
    throw "Dump vazio - nada para migrar"
}
Run-Docker -AllowFailure -Command @('rm', '-f', $ExportContainer)

Write-Host "==> Recriando volume v2 ($V2Volume) com senha do .env..."
Run-Docker -AllowFailure -Command @('volume', 'rm', $V2Volume)

$env:MONGO_PASSWORD = $mongoPassword
Run-Docker -Command @('compose', 'up', '-d', 'mongodb')
Write-Host "    Aguardando Mongo v2 inicializar..."
Start-Sleep -Seconds 8

$ready = $false
for ($i = 0; $i -lt 12; $i++) {
    & docker exec radarchatv2-mongodb-1 mongosh `
        "mongodb://admin:${mongoPassword}@localhost:27017/admin?authSource=admin" `
        --quiet --eval 'db.runCommand({ ping: 1 })' 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) { $ready = $true; break }
    Start-Sleep -Seconds 2
}
if (-not $ready) {
    throw "Mongo v2 nao respondeu a tempo"
}

Write-Host "==> Restaurando dados no volume v2..."
Run-Docker -Command @('cp', $DumpDir, 'radarchatv2-mongodb-1:/tmp/discord-whatsapp-restore')
$restoreScript = @"
REST=/tmp/discord-whatsapp-restore/discord-whatsapp
if [ ! -d `"`$REST`" ]; then REST=/tmp/discord-whatsapp-restore; fi
mongorestore --uri='mongodb://admin:${mongoPassword}@localhost:27017/?authSource=admin' --db discord-whatsapp --drop `"`$REST`"
"@
Run-Docker -Command @('exec', 'radarchatv2-mongodb-1', 'bash', '-c', $restoreScript)

& docker exec radarchatv2-mongodb-1 mongosh `
    "mongodb://admin:${mongoPassword}@localhost:27017/discord-whatsapp?authSource=admin" `
    --quiet --eval 'printjson({users: db.users.countDocuments(), rules: db.rules.countDocuments(), templates: db.templates.countDocuments()})'

Write-Host "==> Subindo Redis v2..."
Run-Docker -Command @('compose', 'up', '-d', 'redis')

Write-Host ""
Write-Host "Migracao concluida. Volumes v2 nativos - v1 nao e mais usado pelo compose."
Write-Host "Proximo: npm run dev (e npm run update:templates se necessario)"
