@echo off
setlocal enabledelayedexpansion

set PORT_START=13000
set PORT_END=15000

echo Scanning for free ports in %PORT_START%-%PORT_END%...

:: Find free APP_PORT
set APP_PORT=
for /L %%p in (%PORT_START%,1,%PORT_END%) do (
    if not defined APP_PORT (
        netstat -an 2>nul | findstr /R /C:"[:.]%%p .*LISTENING" >nul 2>nul
        if errorlevel 1 (
            set APP_PORT=%%p
        )
    )
)

if not defined APP_PORT (
    echo ERROR: No free port found in range %PORT_START%-%PORT_END%
    exit /b 1
)

:: Find free BOARD_PORT (APP_PORT + 10 as starting point)
set /a BOARD_START=%APP_PORT%+10
set BOARD_PORT=
for /L %%p in (%BOARD_START%,1,%PORT_END%) do (
    if not defined BOARD_PORT (
        netstat -an 2>nul | findstr /R /C:"[:.]%%p .*LISTENING" >nul 2>nul
        if errorlevel 1 (
            set BOARD_PORT=%%p
        )
    )
)

if not defined BOARD_PORT set BOARD_PORT=%BOARD_START%

echo   App:   http://localhost:%APP_PORT%
echo   Board: http://localhost:%BOARD_PORT%
echo.

set APP_PORT=%APP_PORT%
set BOARD_PORT=%BOARD_PORT%
docker compose -f docker-compose.dev.yml up %*

