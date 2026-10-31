@echo off
TITLE OrderFlow Sentinel Launcher
COLOR 0A

echo ================================================================
echo   ORDERFLOW SENTINEL: SELF-HEALING AI & DIGITAL TWIN
echo ================================================================
echo.

:: 1. Verify MongoDB Port 27017
echo [1/4] Checking Local MongoDB on port 27017...
powershell -Command "if (Test-NetConnection -ComputerName 127.0.0.1 -Port 27017 -InformationLevel Quiet) { Write-Host '  MongoDB is ACTIVE on port 27017.' -ForegroundColor Green } else { Write-Host '  WARNING: MongoDB port 27017 is not reachable. Starting MongoDB service...' -ForegroundColor Yellow; net start MongoDB }"
echo.

:: 2. Launch Python FastAPI AI Engine
echo [2/4] Starting Python AI Microservice (Port 8000)...
start "OrderFlow Sentinel - AI Engine (Port 8000)" cmd /k "cd /d "%~dp0ai-engine" && python -m uvicorn app:app --host 127.0.0.1 --port 8000 --reload"
timeout /t 3 /nobreak > nul

:: 3. Launch Node.js Backend Gateway
echo [3/4] Starting Node.js Backend Gateway (Port 5000)...
start "OrderFlow Sentinel - Backend Gateway (Port 5000)" cmd /k "cd /d "%~dp0backend" && node server.js"
timeout /t 2 /nobreak > nul

:: 4. Launch React Vite Frontend
echo [4/4] Starting React Frontend Dev Server (Port 5173)...
start "OrderFlow Sentinel - Frontend (Port 5173)" cmd /k "cd /d "%~dp0frontend" && npm run dev"
timeout /t 3 /nobreak > nul

echo.
echo ================================================================
echo   ALL 3 SERVICES LAUNCHED SUCCESSFULLY!
echo ================================================================
echo.
echo   * Frontend UI:        http://localhost:5173
echo   * Backend API:        http://localhost:5000/api
echo   * Python AI Engine:   http://127.0.0.1:8000
echo   * MongoDB Database:   mongodb://127.0.0.1:27017/orderflow_sentinel
echo.
echo Opening browser to http://localhost:5173...
start http://localhost:5173
echo.
pause
