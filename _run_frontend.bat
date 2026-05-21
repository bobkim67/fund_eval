@echo off
cd /d "%~dp0frontend"
if not exist "node_modules" (
  echo Installing npm packages ...
  call npm install
)
npm run dev
