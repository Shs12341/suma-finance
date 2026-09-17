param(
    [switch]$ResetConfig
)

$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$EnvPath = Join-Path $HOME ".finance-app.env"
$CreatedConfig = $false

Write-Host ""
Write-Host "Finance App - local setup" -ForegroundColor Cyan
Write-Host "Config file: $EnvPath"
Write-Host ""

if ($ResetConfig -and (Test-Path $EnvPath)) {
    Remove-Item $EnvPath -Force
    Write-Host "Previous local config removed." -ForegroundColor Yellow
}

if (-not (Test-Path $EnvPath)) {
    $SecurePassword = Read-Host "PostgreSQL password for user postgres" -AsSecureString
    $Bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecurePassword)

    try {
        $DbPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($Bstr)
    }
    finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($Bstr)
    }

    $PasswordB64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($DbPassword))

    $RandomBytes = New-Object byte[] 48
    $Rng = [Security.Cryptography.RandomNumberGenerator]::Create()
    $Rng.GetBytes($RandomBytes)
    $Rng.Dispose()
    $JwtSecret = ($RandomBytes | ForEach-Object { $_.ToString("x2") }) -join ""

    @"
PORT=3000
DB_USER=postgres
DB_HOST=localhost
DB_NAME=finance_app
DB_PASSWORD_B64=$PasswordB64
DB_PORT=5432
CLIENT_ORIGIN=http://localhost:5173
JWT_SECRET=$JwtSecret
COOKIE_NAME=finance_session
NODE_ENV=development
"@ | Set-Content -Path $EnvPath -Encoding ASCII

    $CreatedConfig = $true
    Write-Host "Local config created." -ForegroundColor Green
}
else {
    Write-Host "Existing local config preserved." -ForegroundColor Green
}

Write-Host "Installing backend dependencies..." -ForegroundColor Cyan
Push-Location (Join-Path $Root "backend")
npm install
if ($LASTEXITCODE -ne 0) { throw "Backend npm install failed" }
Pop-Location

Write-Host "Checking PostgreSQL and applying the schema..." -ForegroundColor Cyan
Push-Location (Join-Path $Root "backend")
node -e "require('./src/loadEnv'); const fs=require('fs'); const pool=require('./src/db'); const sql=fs.readFileSync('./sql/001_initial_schema.sql','utf8'); pool.query(sql).then(()=>{console.log('Database connected and schema ready.'); return pool.end()}).catch(error=>{console.error(error.message); process.exit(1)})"
$DatabaseExitCode = $LASTEXITCODE
Pop-Location

if ($DatabaseExitCode -ne 0) {
    if ($CreatedConfig -and (Test-Path $EnvPath)) {
        Remove-Item $EnvPath -Force
    }

    throw "Database check failed. Run .\setup-local.ps1 -ResetConfig and enter the PostgreSQL password again."
}

Write-Host "Installing frontend dependencies..." -ForegroundColor Cyan
Push-Location (Join-Path $Root "frontend")
npm install
if ($LASTEXITCODE -ne 0) { throw "Frontend npm install failed" }
Pop-Location

Write-Host ""
Write-Host "Setup complete. Run .\start-dev.ps1" -ForegroundColor Green
