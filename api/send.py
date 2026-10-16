"""POST /api/send  ->  uploads the report PDF to Healthray's send_wp_report (WhatsApp share).
Note: Vercel limits request bodies to ~4.5 MB; the PDF travels as base64, so keep PDFs under ~3 MB."""
import json, sys, os, base64
from http.server import BaseHTTPRequestHandler
sys.path.insert(0, os.path.dirname(__file__))
from _hr import SEND_URL, clean_headers, call, host_ok, multipart


class handler(BaseHTTPRequestHandler):
    def _send(self, code, obj):
        b = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(b)))
        self.end_headers()
        self.wfile.write(b)

    def do_GET(self):
        self._send(405, {"error": "Use POST"})

    def do_POST(self):
        try:
            req = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))))
            hd = clean_headers(req.get("headers") or {})
            url = req.get("url") or SEND_URL
            if not host_ok(url):
                return self._send(200, {"error": "Only https://*.healthray.com URLs are allowed."})
            data, ctype = multipart(req.get("fields") or [],
                                    (req.get("filename") or "report.pdf").replace('"', ""),
                                    base64.b64decode(req["file"]))
            hd["Content-Type"] = ctype
            code, body = call(url, hd, data, "POST", timeout=55)
            st = body.get("status", code) if isinstance(body, dict) else code
            if st != 200:
                msg = (body.get("message") if isinstance(body, dict) else "") or "Request failed"
                if st in (401, 403):
                    msg += " (tokens expired: enter fresh tokens)"
                return self._send(200, {"error": f"Healthray said {st}: {msg}", "response": body})
            self._send(200, body)
        except Exception as e:
            self._send(200, {"error": f"Server error: {e}"})
