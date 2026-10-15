"""Vercel serverless function: forwards the request to Healthray (avoids browser CORS)."""
import json, urllib.request, urllib.parse, urllib.error
from http.server import BaseHTTPRequestHandler

API = "https://node.healthray.com/api/v1/lab/get_lab_orders"


class handler(BaseHTTPRequestHandler):
    def _send(self, code, body):
        b = body.encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(b)))
        self.end_headers()
        self.wfile.write(b)

    def do_GET(self):
        self._send(405, json.dumps({"error": "Use POST"}))

    def do_POST(self):
        try:
            length = int(self.headers.get("Content-Length", 0))
            req = json.loads(self.rfile.read(length))
            per = int(req.get("per_page") or 50)
            order = str(req.get("order", "DESC")).upper()
            if order not in ("ASC", "DESC"):
                order = "DESC"

            page, out, seen, total_pages = 1, [], set(), None
            while page <= 200:
                q = {
                    "page": page,
                    "per_page": per,
                    "start_date": req.get("start", ""),
                    "end_date": req.get("end", ""),
                    "order_by": "order_date",
                    "order": order,
                }
                url = API + "?" + urllib.parse.urlencode(q, safe=",")
                r = urllib.request.Request(url, headers={
                    "Authorization": "Bearer " + req.get("token", ""),
                    "Accept": "application/json",
                    "Origin": "https://lab.healthray.com",
                    "Referer": "https://lab.healthray.com/",
                    "User-Agent": "Mozilla/5.0",
                })
                try:
                    with urllib.request.urlopen(r, timeout=50) as resp:
                        body = json.loads(resp.read().decode("utf-8", "ignore"))
                except urllib.error.HTTPError as e:
                    raw = e.read().decode("utf-8", "ignore")
                    body = json.loads(raw) if raw else {}

                status_code = body.get("status")
                if status_code != 200:
                    msg = body.get("message", "Request failed")
                    if status_code == 401:
                        msg += " (Token expired: copy a new one from your network tab)"
                    return self._send(200, json.dumps({"error": f"Healthray said {status_code}: {msg}"}))

                rows = body.get("data") or []
                for o in rows:
                    if o.get("id") not in seen:
                        seen.add(o.get("id"))
                        out.append(o)

                if isinstance(body.get("pages"), int):
                    total_pages = body["pages"]
                if not rows or (total_pages and page >= total_pages) or (not total_pages and len(rows) < per):
                    break
                page += 1

            self._send(200, json.dumps({"data": out, "pages": page}))
        except Exception as e:
            self._send(200, json.dumps({"error": f"Server error: {e}"}))
