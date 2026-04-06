@echo off
chcp 65001 >nul
title TransformAI
color 0A

echo =========================================
echo       Iniciando TransformAI...
echo =========================================
echo.

:: Cerrar servidor de TransformAI si ya estaba abierto para evitar errores de puerto
wmic process where "name='powershell.exe' and commandline like '%%server.ps1%%'" call terminate >nul 2>&1

:: Iniciar el servidor web local de manera invisible
start /b powershell -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0server.ps1"

:: Esperar a que el servidor arranque
timeout /t 2 /nobreak >nul

echo Abriendo aplicacion...

:: Intentar abrir con Microsoft Edge en "Modo Aplicacion" nativo (sin menus ni barra de busqueda)
start msedge --app="http://localhost:8080" 2>nul
if %errorlevel% neq 0 (
    :: Intentar con Google Chrome en Modo Aplicacion
    start chrome --app="http://localhost:8080" 2>nul
    if %errorlevel% neq 0 (
        :: Fallback: abrir en el navegador por defecto normalmente
        start http://localhost:8080
    )
)
exit
