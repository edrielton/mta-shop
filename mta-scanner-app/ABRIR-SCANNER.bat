@echo off
title MTA Store Scanner
echo Abrindo MTA Store Scanner...

cd /d "%~dp0"

:: Inicia servidor Python em background e abre o browser
start /b python -m http.server 8765 --bind 127.0.0.1 >nul 2>&1
timeout /t 1 /nobreak >nul
start "" "http://localhost:8765/MTA-Store-Scanner.html"

echo.
echo Scanner aberto no navegador.
echo Para fechar, feche essa janela e o servidor local.
echo.
pause
