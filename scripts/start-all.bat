@echo off
chcp 65001 >nul
cd /d "%~dp0.."
echo 启动 ai-agent-server + ai-agent-web（日志分别在各自 logs 文件夹）
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-all.ps1"
pause
