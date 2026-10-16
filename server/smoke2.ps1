$ErrorActionPreference = 'Stop'
$base = 'http://localhost:4000'
$proc = Start-Process -FilePath node -ArgumentList 'src/index.js' -WorkingDirectory (Get-Location) -PassThru -RedirectStandardOutput 'smoke2_out.log' -RedirectStandardError 'smoke2_err.log'
Start-Sleep -Seconds 2.5
$ok = 0; $fail = 0
function Check($name, $cond, $info) {
  if ($cond) { Write-Output "PASS  $name  $info"; $script:ok++ }
  else { Write-Output "FAIL  $name  $info"; $script:fail++ }
}
try {
  $lands = Invoke-RestMethod "$base/api/v1/lands"
  $landId = $lands[0].id

  $comps = Invoke-RestMethod "$base/api/v1/competitions"
  Check 'competitions list' ($comps.Count -ge 2) "count=$($comps.Count)"
  $active = Invoke-RestMethod "$base/api/v1/competitions/active"
  Check 'active competition' ($active.status -eq 'active' -and $active.daysLeft -ge 0) "daysLeft=$($active.daysLeft) budget=$($active.totalBudget)"

  $adv = Invoke-RestMethod "$base/api/v1/advisor/recommend" -Method Post -ContentType 'application/json' -Body (@{ landId = $landId } | ConvertTo-Json)
  Check 'advisor recommend' ($adv.recommendations.Count -eq 5 -and $adv.topPick) "topPick=$($adv.topPick) score=$($adv.recommendations[0].score)"

  $analytics = Invoke-RestMethod "$base/api/v1/analytics/overview"
  Check 'analytics kpi' ($analytics.kpi.totalHa -gt 0) "totalHa=$($analytics.kpi.totalHa) districts=$($analytics.byDistrict.Count)"
  Check 'analytics funnel' ($analytics.funnel.Count -eq 4) ""

  $ndvi = Invoke-RestMethod "$base/api/v1/ektis/ndvi/$landId"
  Check 'ndvi series' ($ndvi.series.Count -eq 12) "current=$($ndvi.current.value) health=$($ndvi.current.health)"

  # create app -> has score + competition
  $login = Invoke-RestMethod "$base/api/v1/auth/login" -Method Post -ContentType 'application/json' -Body '{"voen":"1234567890","password":"demo123"}'
  $h1 = @{ Authorization = "Bearer $($login.token)" }
  $body = @{ landId = $landId; purpose = $lands[0].purpose; areaHa = $lands[0].areaHa; investmentAmount = 300000 } | ConvertTo-Json
  $app = Invoke-RestMethod "$base/api/v1/applications" -Method Post -ContentType 'application/json' -Headers $h1 -Body $body
  Check 'app score' ($app.score.total -ge 0 -and $app.score.grade) "score=$($app.score.total) grade=$($app.score.grade)"
  Check 'app competition link' ($app.competitionTitle -ne $null) "$($app.competitionTitle)"
}
finally {
  Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
}
Write-Output "`nRESULT: $ok passed, $fail failed"
if ($fail -gt 0) { exit 1 }
