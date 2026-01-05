Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$users = Invoke-RestMethod -Method Get -Uri "https://comsierge-iwe0.onrender.com/api/auth/users"
if (-not $users.success -or -not $users.data -or $users.data.Count -lt 1) { throw "No users returned" }

$picked = $null
foreach ($u in $users.data) {
	$provider = [string]$u.authProvider
	$email = [string]$u.email
	if (-not [string]::IsNullOrWhiteSpace($email) -and $provider -ne "google") {
		$picked = $u
		break
	}
}

if (-not $picked) {
	$picked = $users.data[0]
}

$email = [string]$picked.email
if ([string]::IsNullOrWhiteSpace($email)) { throw "Picked user has no email" }

$provider = [string]$picked.authProvider

$masked = $email.Substring(0,1) + "***@***"

$body = @{ email = $email } | ConvertTo-Json
$r = Invoke-RestMethod -Method Post -Uri "https://comsierge-iwe0.onrender.com/api/auth/forgot-password" -ContentType "application/json" -Body $body

Write-Output ("forgot-password called (masked={0})" -f $masked)
Write-Output ("authProvider={0}" -f $provider)
Write-Output ("success={0}" -f $r.success)
Write-Output ("message={0}" -f $r.message)
