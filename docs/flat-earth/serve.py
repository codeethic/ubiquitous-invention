#!/usr/bin/env python3
"""Static server for local development. Use this instead of `python -m http.server`.

Python's `mimetypes` seeds itself from the Windows registry, and on many
Windows machines `HKEY_CLASSES_ROOT\\.js` carries `Content Type = text/plain`
(installers for editors and runtimes commonly set it). `http.server` then
serves every module as text/plain, and the browser refuses the entire import
graph under strict MIME checking:

    Failed to load module script: Expected a JavaScript-or-Wasm module script
    but the server responded with a MIME type of "text/plain".

The result is a blank page and one console error, with nothing wrong in the
app itself. This server pins the types it serves rather than trusting the
host's registry, so it behaves the same on every machine.

    python serve.py [port]        # default 8000
"""

import sys
from http.server import SimpleHTTPRequestHandler, test


class Handler(SimpleHTTPRequestHandler):
    # Pinned, not merged with the registry-derived defaults: these are the
    # types the app actually serves, and every one of them is a correctness
    # requirement rather than a nicety. A wrong type on any of them is a
    # blank page, not a degraded one.
    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        '.js': 'text/javascript',
        '.mjs': 'text/javascript',
        '.css': 'text/css',
        '.html': 'text/html',
        '.json': 'application/json',
        '.svg': 'image/svg+xml',
        '': 'application/octet-stream',
    }


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    print(f'Flat Earth Lab: http://localhost:{port}/  (Ctrl+C to stop)')
    test(HandlerClass=Handler, port=port, bind='127.0.0.1')
