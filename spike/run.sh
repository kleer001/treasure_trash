#!/usr/bin/env sh
# Serve this directory with no-cache headers so edits show on reload.
# Usage: ./run.sh [port]   (default 8000)
set -eu
PORT="${1:-8000}"
exec python3 -c "
import http.server, socketserver
port = int('${PORT}')
class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        super().end_headers()
with socketserver.TCPServer(('', port), Handler) as httpd:
    print(f'serving http://localhost:{port} (Ctrl-C to stop)')
    httpd.serve_forever()
"
