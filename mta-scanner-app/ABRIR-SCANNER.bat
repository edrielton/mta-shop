@echo off
title MTA Store Scanner
echo Abrindo MTA Store Scanner...

:: Testa se o PowerShell existe
where powershell >nul 2>&1
if errorlevel 1 (
    echo ERRO: PowerShell nao encontrado no Windows.
    pause
    exit /b 1
)

:: Roda o script
powershell.exe -ExecutionPolicy Bypass -NoLogo -File "%~dp0MTA-Store-Scanner.ps1"

:: Se der erro, mostra
if errorlevel 1 (
    echo.
    echo Ocorreu um erro ao abrir o scanner.
    echo Tente clicar com botao direito em ABRIR-SCANNER.bat
    echo e escolha "Executar como administrador"
    echo.
    pause
)
