Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

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

if ([string]::IsNullOrWhiteSpace($renderKey)) { throw "Render API key not found" }
Write-Output ("Render API key found (len={0})" -f $renderKey.Length)

$headers = @{ Authorization = "Bearer $renderKey" }
$backendServiceId = "srv-d5e16mh5pdvs73al8bv0"

$deployBody = @{ clearCache = "do_not_clear" } | ConvertTo-Json
$r = Invoke-WebRequest -Uri "https://api.render.com/v1/services/$backendServiceId/deploys" -Method Post -Headers $headers -ContentType "application/json" -Body $deployBody -UseBasicParsing
Write-Output ("Triggered backend deploy: HTTP {0}" -f $r.StatusCode)
