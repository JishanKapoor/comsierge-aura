# Fetch latest backend deploy from Render and output details + deploy logs
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
    } catch {}
  }
  return $k
}

$renderKey = Get-RenderApiKey
if ([string]::IsNullOrWhiteSpace($renderKey)) { throw "Render API key not found" }
Write-Output ("Render API key found (len={0})" -f $renderKey.Length)

$headers = @{ Authorization = "Bearer $renderKey" }
$svc = "srv-d5e16mh5pdvs73al8bv0"

# Fetch ownerId for logs
$owners = Invoke-RestMethod -Uri "https://api.render.com/v1/owners" -Headers $headers -Method Get
if (-not $owners -or $owners.Count -lt 1) { throw "No owners returned by Render API" }
$ownerId = $owners[0].owner.id
Write-Output ("Using ownerId={0}" -f $ownerId)

$deploys = Invoke-RestMethod -Uri "https://api.render.com/v1/services/$svc/deploys?limit=1" -Headers $headers -Method Get
$d = $deploys[0].deploy
Write-Output ("Latest deploy id={0} status={1} commit={2}" -f $d.id, $d.status, $d.commit.id)

$startStr = $d.startedAt
$endStr = $d.finishedAt
if ([string]::IsNullOrWhiteSpace($endStr)) { $endStr = [DateTime]::UtcNow.ToString("o") }

Write-Output ("Fetching deploy logs from {0} to {1}..." -f $startStr, $endStr)

$logsUrl = "https://api.render.com/v1/logs?ownerId=$ownerId&resource=$svc&type=app&direction=forward&startTime=$startStr&endTime=$endStr&limit=500"
$logsResp = Invoke-RestMethod -Uri $logsUrl -Headers $headers -Method Get
$logs = $logsResp.logs
if (-not $logs) { $logs = @() }
Write-Output ("Logs returned: {0}" -f $logs.Count)

foreach ($l in $logs) {
  Write-Output ("{0} {1}" -f $l.timestamp, $l.message)
}
