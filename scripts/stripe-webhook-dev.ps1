# Encaminha webhooks Stripe (teste) para o RadarZap local.
# Requer Stripe CLI: winget install Stripe.StripeCli
# Uso: powershell -ExecutionPolicy Bypass -File scripts/stripe-webhook-dev.ps1

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $root ".env"

if (-not (Test-Path $envFile)) {
  Write-Error ".env não encontrado em $root"
}

$skLine = Select-String -Path $envFile -Pattern "^STRIPE_SECRET_KEY=(.+)$" | Select-Object -First 1
if (-not $skLine) {
  Write-Error "STRIPE_SECRET_KEY ausente no .env"
}
$sk = $skLine.Matches.Groups[1].Value.Trim()
if (-not $sk) {
  Write-Error "STRIPE_SECRET_KEY vazia"
}

$stripe = Get-Command stripe -ErrorAction SilentlyContinue
if (-not $stripe) {
  Write-Error "Stripe CLI não instalado. Execute: winget install Stripe.StripeCli"
}

Write-Host "Obtendo whsec (Stripe CLI)..."
$whsec = & stripe listen --print-secret --api-key $sk 2>&1 | Select-Object -Last 1
if ($whsec -notmatch "^whsec_") {
  Write-Error "Falha ao obter webhook secret: $whsec"
}

$content = Get-Content $envFile -Raw
if ($content -match "(?m)^STRIPE_WEBHOOK_SECRET=.*$") {
  $content = $content -replace "(?m)^STRIPE_WEBHOOK_SECRET=.*$", "STRIPE_WEBHOOK_SECRET=$whsec"
} else {
  $content = $content.TrimEnd() + "`nSTRIPE_WEBHOOK_SECRET=$whsec`n"
}
Set-Content -Path $envFile -Value $content -NoNewline

Write-Host "STRIPE_WEBHOOK_SECRET atualizado no .env"
Write-Host "Iniciando stripe listen -> http://localhost:3001/api/billing/webhook/stripe"
Write-Host "Reinicie o backend (npm run dev) se já estiver rodando."
Write-Host ""

& stripe listen `
  --api-key $sk `
  --forward-to localhost:3001/api/billing/webhook/stripe `
  --events checkout.session.completed,checkout.session.expired,invoice.paid,customer.subscription.deleted
