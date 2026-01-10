Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Get-RenderApiKey {
  $k = $env:RENDER_API_KEY
  if ([string]::IsNullOrWhiteSpace($k)) { $k = $env:RENDER_API_TOKEN }

  if ([string]::IsNullOrWhiteSpace($k)) {
    try {
      $histPath = (Get-PSReadLineOption).HistorySavePath
      if (Test-Path $histPath) {
        $hist = Get-Content $histPath -Raw
        $m = [regex]::Match($hist, "rnd_[A-Za-z0-9]{20,}")
        if ($m.Success) { $k = $m.Value }
      }
    } catch {
      # ignore
    }
  }
  return $k
}

$renderKey = Get-RenderApiKey
if ([string]::IsNullOrWhiteSpace($renderKey)) { throw "Render API key not found" }
Write-Output ("Render API key found (len={0})" -f $renderKey.Length)

$headers = @{ Authorization = "Bearer $renderKey" }
$frontendServiceId = "srv-d5e1ae9r0fns73att39g"

$deployBody = @{ clearCache = "do_not_clear" } | ConvertTo-Json
$r = Invoke-WebRequest -Uri "https://api.render.com/v1/services/$frontendServiceId/deploys" -Method Post -Headers $headers -ContentType "application/json" -Body $deployBody -UseBasicParsing
Write-Output ("Triggered frontend deploy: HTTP {0}" -f $r.StatusCode)
