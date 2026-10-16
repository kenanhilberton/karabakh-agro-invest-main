$ErrorActionPreference = 'Stop'
$base = 'http://localhost:4000'
$proc = Start-Process -FilePath node -ArgumentList 'src/index.js' -WorkingDirectory (Get-Location) -PassThru -RedirectStandardOutput 'smoke_out.log' -RedirectStandardError 'smoke_err.log'
Start-Sleep -Seconds 2.5
$ok = 0; $fail = 0
function Check($name, $cond, $info) {
  if ($cond) { Write-Output "PASS  $name  $info"; $script:ok++ }
  else { Write-Output "FAIL  $name  $info"; $script:fail++ }
}
try {
  $h = Invoke-RestMethod "$base/api/health"
  Check 'health' ($h.status -eq 'ok') ''

  $meta = Invoke-RestMethod "$base/api/v1/lands/meta"
  Check 'meta' ($meta.districts.Count -ge 10 -and $meta.crops.Count -eq 5) "districts=$($meta.districts.Count) crops=$($meta.crops.Count)"

  $lands = Invoke-RestMethod "$base/api/v1/lands"
  Check 'lands' ($lands.Count -ge 14) "count=$($lands.Count)"
  $landId = $lands[0].id

  $stats = Invoke-RestMethod "$base/api/v1/lands/stats"
  Check 'stats' ($stats.totalHa -gt 0) "totalHa=$($stats.totalHa)"

  $roi = Invoke-RestMethod "$base/api/v1/roi/simulate" -Method Post -ContentType 'application/json' -Body '{"purpose":"pambiq","areaHa":50}'
  Check 'roi' ($roi.capex -gt 0 -and $roi.roi5y -ne $null) "capex=$($roi.capex) payback=$($roi.paybackYears)y roi5y=$($roi.roi5y)%"

  $verify = Invoke-RestMethod "$base/api/v1/ektis/farmer/verify/1234567890"
  Check 'ektis verify' ($verify.verified -eq $true) $verify.message

  $login = Invoke-RestMethod "$base/api/v1/auth/login" -Method Post -ContentType 'application/json' -Body '{"voen":"1234567890","password":"demo123"}'
  Check 'login applicant' ($login.token.Length -gt 20) "role=$($login.user.role)"
  $h1 = @{ Authorization = "Bearer $($login.token)" }

  $appBody = @{ landId = $landId; purpose = 'pambiq'; areaHa = 50; businessPlan = 'test'; investmentAmount = 200000 } | ConvertTo-Json
  $app = Invoke-RestMethod "$base/api/v1/applications" -Method Post -ContentType 'application/json' -Headers $h1 -Body $appBody
  Check 'create application' ($app.trackingCode -like 'KAI-*') "code=$($app.trackingCode) status=$($app.status)"

  $track = Invoke-RestMethod "$base/api/v1/applications/track/$($app.trackingCode)"
  Check 'public track' ($track.trackingCode -eq $app.trackingCode) ''

  $sync = Invoke-RestMethod "$base/api/v1/ektis/applications/sync" -Method Post -ContentType 'application/json' -Body (@{ applicationId = $app.id } | ConvertTo-Json)
  Check 'ektis sync' ($sync.accepted -eq $true) $sync.ektisReference

  # RBAC: applicant must NOT change status
  $denied = $false
  try { Invoke-RestMethod "$base/api/v1/applications/$($app.id)/status" -Method Patch -ContentType 'application/json' -Headers $h1 -Body '{"status":"approved"}' } catch { $denied = $_.Exception.Response.StatusCode.value__ -eq 403 }
  Check 'rbac 403 for applicant' $denied ''

  $op = Invoke-RestMethod "$base/api/v1/auth/login" -Method Post -ContentType 'application/json' -Body '{"voen":"ADMIN00000","password":"admin123"}'
  $h2 = @{ Authorization = "Bearer $($op.token)" }
  $updated = Invoke-RestMethod "$base/api/v1/applications/$($app.id)/status" -Method Patch -ContentType 'application/json' -Headers $h2 -Body '{"status":"approved","note":"demo"}'
  Check 'operator approve' ($updated.status -eq 'approved') "status=$($updated.status)"

  $ektisLands = Invoke-RestMethod "$base/api/v1/ektis/lands"
  Check 'ektis lands' ($ektisLands.count -ge 14) "count=$($ektisLands.count)"

  $docs = Invoke-RestMethod "$base/api-docs.json"
  $pathCount = @($docs.paths.PSObject.Properties).Count
  Check 'openapi' ($docs.openapi -eq '3.0.3' -and $pathCount -ge 13) "paths=$pathCount"

  $ui = Invoke-RestMethod "$base/api-docs/"
  Check 'swagger ui' ($ui.Length -gt 100) ''
}
finally {
  Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
}
Write-Output "`nRESULT: $ok passed, $fail failed"
if ($fail -gt 0) { exit 1 }
