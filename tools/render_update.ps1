Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Write-Output "Starting Render env update..."

# Load SMTP password (do not print value)
$dotenvPath = Join-Path $PSScriptRoot "..\server\.env"
if (!(Test-Path $dotenvPath)) { throw "server/.env not found at $dotenvPath" }
$dotenvRaw = Get-Content $dotenvPath -Raw
$mm = [regex]::Match($dotenvRaw, "(?m)^SMTP_PASSWORD=(.*)$")
if (!$mm.Success) { throw "SMTP_PASSWORD not found in server/.env" }
$smtpPass = $mm.Groups[1].Value.Trim()
if ((($smtpPass.StartsWith('"') -and $smtpPass.EndsWith('"')) -or ($smtpPass.StartsWith("'") -and $smtpPass.EndsWith("'"))) -and $smtpPass.Length -ge 2) {
  $smtpPass = $smtpPass.Substring(1, $smtpPass.Length - 2)
}
if ([string]::IsNullOrWhiteSpace($smtpPass)) { throw "SMTP_PASSWORD empty in server/.env" }
Write-Output ("SMTP_PASSWORD loaded (len={0})" -f $smtpPass.Length)

# Find Render API key (do not print value)
$renderKey = $env:RENDER_API_KEY
if ([string]::IsNullOrWhiteSpace($renderKey)) { $renderKey = $env:RENDER_API_TOKEN }

if ([string]::IsNullOrWhiteSpace($renderKey)) {
  try {
    $histPath = (Get-PSReadLineOption).HistorySavePath
    if (Test-Path $histPath) {
      $hist = Get-Content $histPath -Raw
      $m = [regex]::Match($hist, "rnd_[A-Za-z0-9]{20,}")
      if ($m.Success) { $renderKey = $m.Value }
    }
  } catch {
    # ignore
  }
}

if ([string]::IsNullOrWhiteSpace($renderKey)) { throw "Render API key not found in env vars or PSReadLine history" }
Write-Output ("Render API key found (len={0})" -f $renderKey.Length)

$headers = @{ Authorization = "Bearer $renderKey" }
$backendServiceId = "srv-d5e16mh5pdvs73al8bv0"
$frontendServiceId = "srv-d5e1ae9r0fns73att39g"

# Update env var
$envUrl = "https://api.render.com/v1/services/$backendServiceId/env-vars/SMTP_PASSWORD"
$envBody = @{ value = $smtpPass } | ConvertTo-Json
$r1 = Invoke-WebRequest -Uri $envUrl -Method Put -Headers $headers -ContentType "application/json" -Body $envBody -UseBasicParsing
Write-Output ("Updated backend SMTP_PASSWORD: HTTP {0}" -f $r1.StatusCode)

# Trigger deploys
$deployBody = @{ clearCache = "do_not_clear" } | ConvertTo-Json
$r2 = Invoke-WebRequest -Uri "https://api.render.com/v1/services/$backendServiceId/deploys" -Method Post -Headers $headers -ContentType "application/json" -Body $deployBody -UseBasicParsing
Write-Output ("Triggered backend deploy: HTTP {0}" -f $r2.StatusCode)

$r3 = Invoke-WebRequest -Uri "https://api.render.com/v1/services/$frontendServiceId/deploys" -Method Post -Headers $headers -ContentType "application/json" -Body $deployBody -UseBasicParsing
Write-Output ("Triggered frontend deploy: HTTP {0}" -f $r3.StatusCode)

Write-Output "Render env update complete."
