# Vite 开发：控制台 + logs/web-dev-*.log
# 用法: .\scripts\start-dev.ps1  |  npm run dev:log

. "$PSScriptRoot\_init-console-utf8.ps1"

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

$logDir = Join-Path $projectRoot "logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$logFile = Join-Path $logDir ("web-dev-{0}.log" -f (Get-Date -Format "yyyyMMdd-HHmmss"))

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  ai-agent-web（Vite）" -ForegroundColor Cyan
Write-Host "  日志文件: $logFile" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

npm run dev 2>&1 | Tee-Object -FilePath $logFile
