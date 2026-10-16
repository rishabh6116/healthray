"""POST /api/patients  ->  pages through a Healthray patients list request (URL + headers come from the pasted cURL)."""
import json, math, urllib.request, urllib.parse, urllib.error
from datetime import datetime, timedelta
from http.server import BaseHTTPRequestHandler

SIZE_KEYS = ("per_page", "page_size", "pageSize", "limit", "size")
PAGE_KEYS = ("page", "page_no", "pageNo", "page_number", "pageNumber")
DROP = {"host", "content-length", "accept-encoding", "connection", "if-none-match",
        "if-modified-since", "priority", "range"}


def host_ok(url):
    u = urllib.parse.urlsplit(url or "")
    h = (u.hostname or "").lower()
    return u.scheme == "https" and (h == "healthray.com" or h.endswith(".healthray.com"))


def clean_headers(h):
    out = {}
    for k, v in h.items():
        kl = k.lower()
        if kl in DROP or kl.startswith(":") or kl.startswith("sec-"):
            continue
        out[k] = str(v)
    low = {k.lower() for k in out}
    out.setdefault("Accept", "application/json")
    if "origin" not in low:
        out["Origin"] = "https://lab.healthray.com"
    if "referer" not in low:
        out["Referer"] = "https://lab.healthray.com/"
    if "user-agent" not in low:
        out["User-Agent"] = "Mozilla/5.0"
    return out


def apply_paging(d, page, per):
    pk = next((k for k in PAGE_KEYS if k in d), "page")
    sk = next((k for k in SIZE_KEYS if k in d), "per_page")
    d[pk], d[sk] = page, per


def ist_date(o):
    """created_at (UTC ISO) -> 'YYYY-MM-DD' in IST, or None."""
    try:
        t = datetime.fromisoformat(str(o.get("created_at")).replace("Z", "+00:00"))
        return (t + timedelta(hours=5, minutes=30) - (t.utcoffset() or timedelta(0))).strftime("%Y-%m-%d")
    except Exception:
        return None


def find_rows(b):
    if isinstance(b, list):
        return b if all(isinstance(x, dict) for x in b) else []
    if not isinstance(b, dict):
        return []
    for k in ("data", "rows", "items", "patients", "results", "list"):
        v = b.get(k)
        if isinstance(v, (list, dict)):
            r = find_rows(v)
            if r or isinstance(v, list):
                return r
    for v in b.values():
        if isinstance(v, list) and v and isinstance(v[0], dict):
            return v
    return []


def find_pages(b, per):
    if not isinstance(b, dict):
        return None
    ds = [b] + [x for x in (b.get("data"), b.get("meta"), b.get("pagination")) if isinstance(x, dict)]
    for d in ds:
        for k in ("pages", "total_pages", "totalPages", "last_page"):
            if isinstance(d.get(k), int) and d[k] > 0:
                return d[k]
    for d in ds:
        for k in ("total", "count", "total_count", "totalCount", "total_records"):
            if isinstance(d.get(k), int) and d[k] > 0:
                return math.ceil(d[k] / per)
    return None


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
            url = req.get("url", "")
            if not host_ok(url):
                return self._send(200, {"error": "Only https://*.healthray.com URLs are allowed."})
            method = str(req.get("method") or "GET").upper()
            per = int(req.get("per_page") or 50)
            max_pages = int(req.get("max_pages") or 0) or 200
            headers = clean_headers(req.get("headers") or {})
            body_tpl = None
            if method != "GET" and req.get("body"):
                try:
                    body_tpl = json.loads(req["body"])
                except ValueError:
                    body_tpl = None

            start, end = req.get("start") or "", req.get("end") or ""
            page, out, seen, total_pages, desc = 1, [], set(), None, None
            while page <= max_pages:
                data = None
                if method == "GET":
                    u = urllib.parse.urlsplit(url)
                    q = dict(urllib.parse.parse_qsl(u.query, keep_blank_values=True))
                    apply_paging(q, page, per)
                    full = urllib.parse.urlunsplit((u.scheme, u.netloc, u.path, urllib.parse.urlencode(q, safe=","), ""))
                else:
                    full = url
                    if isinstance(body_tpl, dict):
                        b = dict(body_tpl)
                        apply_paging(b, page, per)
                        data = json.dumps(b).encode()
                    elif req.get("body"):
                        data = req["body"].encode()
                    headers.setdefault("Content-Type", "application/json")
                r = urllib.request.Request(full, data=data, method=method, headers=headers)
                try:
                    with urllib.request.urlopen(r, timeout=50) as resp:
                        raw = resp.read().decode("utf-8", "ignore")
                        code = resp.status
                except urllib.error.HTTPError as e:
                    raw = e.read().decode("utf-8", "ignore")
                    code = e.code
                try:
                    body = json.loads(raw) if raw else {}
                except ValueError:
                    return self._send(200, {"error": f"Healthray returned a non-JSON response (HTTP {code})."})

                status_code = body.get("status") if isinstance(body, dict) else None
                if (status_code is not None and status_code != 200) or (status_code is None and code >= 400):
                    sc = status_code or code
                    msg = (body.get("message") if isinstance(body, dict) else None) or "Request failed"
                    if sc in (401, 403):
                        msg += " (tokens missing or expired: copy a fresh cURL of the patient request from the network tab)"
                    return self._send(200, {"error": f"Healthray said {sc}: {msg}"})

                rows = find_rows(body)
                fresh, too_old = 0, False
                if start and end:
                    ds = [d for d in map(ist_date, rows) if d]
                    if desc is None and ds:
                        desc = all(a >= b for a, b in zip(ds, ds[1:]))
                    too_old = bool(desc and ds and min(ds) < start)
                for o in rows:
                    key = o.get("id") if o.get("id") is not None else json.dumps(o, sort_keys=True)
                    if key not in seen:
                        seen.add(key)
                        fresh += 1
                        d = ist_date(o)
                        if start and end and d and not (start <= d <= end):
                            continue
                        out.append(o)

                tp = find_pages(body, per)
                if tp:
                    total_pages = tp
                if not rows or not fresh or too_old or (total_pages and page >= total_pages) or (not total_pages and len(rows) < per):
                    break
                page += 1

            self._send(200, {"data": out, "pages": page})
        except Exception as e:
            self._send(200, {"error": f"Server error: {e}"})
