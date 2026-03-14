# Solar System Explorer

A browser-based 3D simulation of the Solar System built with Three.js.

## How to Run

Because this project uses ES Modules, you cannot open `index.html` directly from the file system due to browser security restrictions (CORS). You must serve it via a local web server.

### Option 1: Using Python (Pre-installed on most systems)
1. Open a terminal/command prompt.
2. Navigate to this directory:
   ```bash
   cd src/solar-system-explorer
   ```
3. Run the Python HTTP server:
   ```bash
   # Python 3
   python -m http.server
   
   # Python 2
   python -m SimpleHTTPServer
   ```
4. Open your browser to `http://localhost:8000`.

### Option 2: Using Node.js (npx)
1. Navigate to this directory.
2. Run:
   ```bash
   npx serve
   ```

### Option 3: VS Code Live Server
1. Open the project in VS Code.
2. Right-click `index.html` and select "Open with Live Server" (requires the Live Server extension).

## Features
- **3D Visualization:** Realistic (scaled) representation of the sun and 8 planets.
- **Orbits:** Visual orbital paths.
- **Interactivity:** Click on planets to view details.
- **Controls:** Zoom, Pan, and Rotate around the system.
