"""Tiny static dev server with no-cache headers (so edits show immediately).
Usage: python3 tools/serve.py [port]   ->  http://localhost:8000
"""
import http.server, os, sys

class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
print(f'Serving on http://localhost:{port}')
http.server.ThreadingHTTPServer(('127.0.0.1', port), Handler).serve_forever()
