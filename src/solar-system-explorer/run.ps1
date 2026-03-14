# Solar System Explorer Runner
Write-Host "Starting Solar System Explorer..." -ForegroundColor Cyan
Write-Host "Please ensure you have Python installed." -ForegroundColor Yellow

# Attempt to start the default browser pointing to the server address
Start-Process "http://localhost:8000"

# Start the Python HTTP server in the current directory
# This command will block the terminal until the server is stopped (Ctrl+C)
python -m http.server 8000
