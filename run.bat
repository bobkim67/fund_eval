@echo off
setlocal EnableDelayedExpansion

cd /d "%~dp0"

REM ─── snapshot 갱신 prompt ───
echo.
echo ============================================================
echo  snapshot 갱신
echo ============================================================
echo  n        : skip (현재 snapshot 그대로 사용)
echo  l        : 최신 (어제까지) fetch
echo  YYYYMMDD : 특정 날짜 fetch (예: 20260430)
echo            여러 날짜는 공백으로 구분 (예: 20260131 20260228)
echo ============================================================
set /p choice="선택: "

if /i "%choice%"=="n" goto :skip_snap
if /i "%choice%"=="" goto :skip_snap

if /i "%choice%"=="l" (
  echo.
  echo [최신 snapshot fetch]
  "C:\Users\user\Downloads\python\.venv\Scripts\python.exe" api\build_full_snapshot.py
  goto :skip_snap
)

REM 그 외 = 날짜로 간주
echo.
echo [날짜 snapshot fetch: %choice%]
"C:\Users\user\Downloads\python\.venv\Scripts\python.exe" api\build_snapshots_by_date.py %choice%

:skip_snap

REM ─── frontend/public/snapshots/ 동기화 (Cloudflare 정적 호스팅용) ───
echo.
echo [snapshot -> frontend/public 동기화]
"C:\Users\user\Downloads\python\.venv\Scripts\python.exe" frontend\scripts\sync_snapshots.py

REM ─── FastAPI 백그라운드 실행 ───
start "PensionEval-API" cmd /k "_run_api.bat"

REM ─── Vite dev ───
start "PensionEval-Frontend" cmd /k "_run_frontend.bat"

REM ─── 브라우저 열기 ───
timeout /t 6 /nobreak >nul
start "" "http://localhost:5174/"

echo.
echo 두 cmd 창 (PensionEval-API, PensionEval-Frontend) 열렸습니다.
echo 브라우저: http://localhost:5174/
echo 종료: 두 창 모두 닫기
echo.
pause
