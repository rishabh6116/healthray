"""POST /api/cases  ->  lists lab patient cases in a date range (for the Send Report picker)."""
import json, sys, os, urllib.parse
from http.server import BaseHTTPRequestHandler
sys.path.insert(0, os.path.dirname(__file__))
from _hr import CASES_URL, clean_headers, call, slim


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
            out, page, pages = [], 1, 1
            while page <= min(pages, 5):
                q = urllib.parse.urlencode({"page": page, "per_page": 100, "report_type": "lab",
                                            "from_date": req["from"], "to_date": req["to"],
                                            "order_by": "is_urgent_case", "order": "DESC",
                                            "is_healthray_case": "true"})
                code, body = call(CASES_URL + "?" + q, hd)
                st = body.get("status", code) if isinstance(body, dict) else code
                if code >= 400 or st != 200 or not isinstance(body.get("data"), list):
                    hint = " (login expired or missing: enter fresh tokens)" if st in (401, 403) else ""
                    return self._send(200, {"error": f"Healthray {st}: {json.dumps(body)[:250]}{hint}"})
                out += [slim(c) for c in body["data"]]
                pages = body.get("pages") or 1
                page += 1
            self._send(200, {"cases": out})
        except Exception as e:
            self._send(200, {"error": f"Server error: {e}"})
