@echo off
title MTA Store Scanner - Build EXE
color 0A

echo ============================================
echo  MTA Store Scanner - Criando .exe
echo ============================================
echo.

:: Verifica se Python esta instalado
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERRO] Python nao encontrado!
    echo Baixe em: https://python.org/downloads
    echo Marque "Add Python to PATH" na instalacao
    pause
    exit /b 1
)

echo [1/3] Instalando PyInstaller...
pip install pyinstaller --quiet
if errorlevel 1 (
    echo [ERRO] Falha ao instalar PyInstaller
    pause
    exit /b 1
)

echo [2/3] Criando o .exe...
pyinstaller --onefile --windowed --name "MTA-Store-Scanner" --icon=icon.ico scanner.py 2>nul
if errorlevel 1 (
    pyinstaller --onefile --windowed --name "MTA-Store-Scanner" scanner.py
)
if errorlevel 1 (
    echo [ERRO] Falha ao criar .exe
    pause
    exit /b 1
)

echo [3/3] Copiando para pasta atual...
if exist "dist\MTA-Store-Scanner.exe" (
    copy "dist\MTA-Store-Scanner.exe" "MTA-Store-Scanner.exe" >nul
    rmdir /s /q build >nul 2>&1
    rmdir /s /q dist  >nul 2>&1
    del /q *.spec     >nul 2>&1
)

echo.
echo ============================================
echo  PRONTO! Arquivo criado: MTA-Store-Scanner.exe
echo ============================================
echo.
pause
