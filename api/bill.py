"""POST /api/bill  ->  checks whether a lab order's bill is paid."""
import json, sys, os, urllib.parse
from http.server import BaseHTTPRequestHandler
sys.path.insert(0, os.path.dirname(__file__))
from _hr import BILL_URL, clean_headers, call


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
            url = BILL_URL.format(oid=urllib.parse.quote(str(req["order_id"])),
                                  org=urllib.parse.quote(str(req.get("org") or "")))
            code, body = call(url, hd)
            if code >= 400 or (isinstance(body, dict) and body.get("status") in (401, 403)):
                hint = " (login expired or missing: enter fresh tokens)" if code in (401, 403) else ""
                return self._send(200, {"error": f"Healthray {code}: {json.dumps(body)[:250]}{hint}"})
            d = body.get("data") or {}
            self._send(200, {"is_bill_paid": d.get("is_bill_paid"), "message": body.get("message")})
        except Exception as e:
            self._send(200, {"error": f"Server error: {e}"})
