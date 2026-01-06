$ErrorActionPreference = 'Stop'

$renderKey = $env:RENDER_API_KEY
if ([string]::IsNullOrWhiteSpace($renderKey)) { $renderKey = $env:RENDER_API_TOKEN }
if ([string]::IsNullOrWhiteSpace($renderKey)) { throw "No Render API key found" }
Write-Output ("Render API key found (len={0})" -f $renderKey.Length)

$headers = @{ 
  Authorization = "Bearer $renderKey"
  "Content-Type" = "application/json" 
}
$frontendServiceId = "srv-d5e1ae9r0fns73att39g"

# Add SPA rewrite rule
$body = '{"routes":[{"type":"rewrite","source":"/*","destination":"/index.html"}]}'

Write-Output "Adding SPA rewrite rules to frontend service..."
try {
  $response = Invoke-RestMethod -Uri "https://api.render.com/v1/services/$frontendServiceId" -Headers $headers -Method Patch -Body $body
  Write-Output "Success! Routes now configured:"
  $response.routes | ForEach-Object { Write-Output ("  {0} {1} -> {2}" -f $_.type, $_.source, $_.destination) }
} catch {
  Write-Output ("Error: {0}" -f $_.Exception.Message)
  throw
}

# Trigger redeploy to apply new routes
Write-Output "Triggering frontend redeploy..."
$deployResponse = Invoke-RestMethod -Uri "https://api.render.com/v1/services/$frontendServiceId/deploys" -Headers $headers -Method Post -Body "{}"
Write-Output ("Deploy triggered: {0}" -f $deployResponse.id)
