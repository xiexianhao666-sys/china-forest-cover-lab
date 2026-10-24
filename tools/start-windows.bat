@echo off
rem china-forest-cover-lab launcher entry (Windows).
rem Serves ../dist over HTTP and opens the default browser.
setlocal
chcp 65001 >nul
set "HERE=%~dp0"
set "PY="

where python >nul 2>nul && python -c "import sys" >nul 2>nul && set "PY=python"
if not defined PY (where py >nul 2>nul && py -3 -c "import sys" >nul 2>nul && set "PY=py -3")
if not defined PY (if exist "E:\python\python.exe" (E:\python\python.exe -c "import sys" >nul 2>nul && set "PY=E:\python\python.exe"))

if not defined PY goto :nopython

%PY% "%HERE%launcher.py" %*
set "CODE=%ERRORLEVEL%"
if "%CODE%"=="0" goto :eof
echo.
echo Launcher exited with code %CODE% (0 ok / 2 dist not found / 3 no free port).
pause
goto :eof

:nopython
echo Python 3 not found.
echo Install Python 3 (https://www.python.org/downloads/) or run the launcher manually:
echo   E:\python\python.exe "%~dp0launcher.py"
pause
