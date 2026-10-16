"""Local stand-in for Vercel: serves api/*.py on http://localhost:3000 (what `npm run dev` proxies /api and /fetch to).
Run in a second terminal:  python dev_api.py   (or: npm run api)
"""
import importlib.util, os, sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

API = os.path.join(os.path.dirname(os.path.abspath(__file__)), "api")
sys.path.insert(0, API)
PORT = 3000


def load(name):
    path = os.path.join(API, name + ".py")
    if not os.path.isfile(path) or name.startswith("_"):
        return None
    spec = importlib.util.spec_from_file_location("api_" + name, path)  # re-read on every request: edits apply without restart
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return getattr(mod, "handler", None)


class Dev(BaseHTTPRequestHandler):
    def _run(self):
        path = self.path.split("?")[0].rstrip("/")
        name = "fetch" if path == "/fetch" else path[5:] if path.startswith("/api/") else ""
        H = load(name) if name and "/" not in name else None
        if not H:
            body = b'{"error": "Not found"}'
            self.send_response(404)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        # reuse the already-open connection with the real handler class
        Sub = type("Sub", (H,), {"setup": lambda s: None, "handle": lambda s: None, "finish": lambda s: None})
        h = Sub(self.request, self.client_address, self.server)
        h.rfile, h.wfile, h.headers = self.rfile, self.wfile, self.headers
        h.path, h.command, h.request_version, h.requestline = self.path, self.command, self.request_version, self.requestline
        getattr(h, "do_" + self.command, h.do_GET)()

    do_GET = do_POST = do_OPTIONS = _run

    def log_message(self, fmt, *a):
        print("%s %s" % (self.command, self.path), *a[1:2])


if __name__ == "__main__":
    print(f"API running on http://localhost:{PORT}  (keep this open, then run `npm run dev` in another terminal)")
    ThreadingHTTPServer(("127.0.0.1", PORT), Dev).serve_forever()
