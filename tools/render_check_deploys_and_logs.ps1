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
$backendServiceId = "srv-d5e16mh5pdvs73al8bv0"
$frontendServiceId = "srv-d5e1ae9r0fns73att39g"

# OwnerId needed for logs
$owners = Invoke-RestMethod -Uri "https://api.render.com/v1/owners" -Headers $headers -Method Get
if (-not $owners -or $owners.Count -lt 1) { throw "No owners returned by Render API" }
$ownerId = $owners[0].owner.id
Write-Output ("Using ownerId={0}" -f $ownerId)

function Show-LatestDeploy($serviceId, $label) {
  $deploys = Invoke-RestMethod -Uri "https://api.render.com/v1/services/$serviceId/deploys?limit=5" -Headers $headers -Method Get
  if (-not $deploys -or $deploys.Count -lt 1) {
    Write-Output "${label}: No deploys returned"
    return
  }
  $d = $deploys[0].deploy
  $commitId = $null
  if ($d.commit -and $d.commit.id) { $commitId = $d.commit.id }
  $commitDisplay = $commitId
  if ([string]::IsNullOrWhiteSpace($commitDisplay)) { $commitDisplay = "<none>" }
  Write-Output ("{0}: status={1} trigger={2} commit={3}" -f $label, $d.status, $d.trigger, $commitDisplay)
}

Show-LatestDeploy $backendServiceId "Backend"
Show-LatestDeploy $frontendServiceId "Frontend"

# Fetch recent logs (last ~30 minutes) and filter locally for email-related text
$end = [DateTime]::UtcNow
$start = $end.AddMinutes(-30)

$startIso = $start.ToString("o")
$endIso = $end.ToString("o")

# Note: Render logs endpoint expects repeated query params; simplest is to include single values.
$logsUrl = "https://api.render.com/v1/logs?ownerId=$ownerId&resource=$backendServiceId&type=app&direction=backward&startTime=$startIso&endTime=$endIso&limit=200"

try {
  Write-Output ("Querying logs: {0}" -f $logsUrl)
  $logsResp = Invoke-RestMethod -Uri $logsUrl -Headers $headers -Method Get
  Write-Output "Logs query succeeded."
  if ($logsResp -and $logsResp.logs) {
    Write-Output ("Logs returned: {0}" -f $logsResp.logs.Count)
    $mailMatches = @()
    foreach ($l in $logsResp.logs) {
      $msg = [string]$l.message
      if ($msg -match '(?i)nodemailer|smtp|password reset|verification email|error sending|sendMail') {
        $mailMatches += $l
      }
    }

    if ($mailMatches.Count -gt 0) {
      Write-Output "--- Recent backend log matches (up to 30) ---"
      $top = $mailMatches | Select-Object -First 30
      foreach ($l in $top) {
        Write-Output ("{0} {1}" -f $l.timestamp, $l.message)
      }
    } else {
      Write-Output "No obvious mail-related log lines found in last 30 minutes."
      Write-Output "--- Sample of recent backend logs (first 10) ---"
      $logsResp.logs | Select-Object -First 10 | ForEach-Object {
        Write-Output ("{0} {1}" -f $_.timestamp, $_.message)
      }
      Write-Output "Tip: trigger a forgot-password request, then re-run this script."
    }
  } else {
    Write-Output "No logs returned in last 30 minutes."
  }
} catch {
  Write-Output "WARNING: Failed to query logs endpoint."
  $ex = $_.Exception
  $respProp = $null
  if ($ex) { $respProp = $ex.PSObject.Properties['Response'] }
  if ($respProp -and $respProp.Value -and $respProp.Value.StatusCode) {
    Write-Output ("HTTP status: {0}" -f $respProp.Value.StatusCode)
  } else {
    Write-Output ("Error: {0}" -f $ex.Message)
  }
}
