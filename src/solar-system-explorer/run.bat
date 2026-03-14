@echo off
echo Starting Solar System Explorer...
echo Please ensure you have Python installed.
echo Opening http://localhost:8000 in your browser...

start http://localhost:8000

python -m http.server 8000
pause
