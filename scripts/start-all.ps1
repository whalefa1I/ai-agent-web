# 一键启动：ai-agent-server + ai-agent-web（各自 logs/）
# 用法: npm run start:all

param(
    [string] $ServerRoot = $env:AI_AGENT_SERVER_ROOT
)

. "$PSScriptRoot\_init-console-utf8.ps1"

$ErrorActionPreference = "Stop"

$WebRoot = Split-Path -Parent $PSScriptRoot

if (-not $ServerRoot) {
    $ProjectRoot = Split-Path $WebRoot
    $ServerRoot = Join-Path $ProjectRoot "ai-agent-server"
}

$ServerScript = Join-Path $ServerRoot "scripts\start-dev.ps1"
$WebScript = Join-Path $WebRoot "scripts\start-dev.ps1"

if (-not (Test-Path (Join-Path $ServerRoot "pom.xml"))) {
    Write-Error "未找到 ai-agent-server：$ServerRoot。请与 ai-agent-web 同级放置，或设置 AI_AGENT_SERVER_ROOT。"
    exit 1
}
if (-not (Test-Path $ServerScript)) {
    Write-Error "缺少脚本：$ServerScript"
    exit 1
}
if (-not (Test-Path $WebScript)) {
    Write-Error "缺少脚本：$WebScript"
    exit 1
}

Write-Host ""
Write-Host "[start-all] 服务端日志目录: $(Join-Path $ServerRoot 'logs')" -ForegroundColor Green
Write-Host "[start-all] Web 日志目录:    $(Join-Path $WebRoot 'logs')" -ForegroundColor Green
Write-Host ""

$shellExe = Join-Path $env:SystemRoot "System32\WindowsPowerShell\v1.0\powershell.exe"
if (Get-Command pwsh -ErrorAction SilentlyContinue) {
    $shellExe = (Get-Command pwsh).Source
}

Start-Process -FilePath $shellExe -ArgumentList @(
    "-NoProfile", "-ExecutionPolicy", "Bypass", "-NoExit",
    "-File", $ServerScript
)

Start-Sleep -Seconds 2

Start-Process -FilePath $shellExe -ArgumentList @(
    "-NoProfile", "-ExecutionPolicy", "Bypass", "-NoExit",
    "-File", $WebScript
)

Write-Host "[start-all] 已打开两个窗口；关闭窗口即停止对应进程。" -ForegroundColor Yellow
Write-Host ""
