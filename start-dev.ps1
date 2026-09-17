$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Backend = Join-Path $Root "backend"
$Frontend = Join-Path $Root "frontend"

Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$Backend'; npm start"
Start-Sleep -Milliseconds 700
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$Frontend'; npm run dev"

Write-Host "Backend and frontend terminals opened." -ForegroundColor Green
Write-Host "Frontend: http://localhost:5173"
Write-Host "Backend:  http://localhost:3000"
