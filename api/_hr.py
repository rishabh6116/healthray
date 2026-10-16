"""Shared helpers for the Healthray proxy functions (underscore = not deployed as a route)."""
import json, uuid, urllib.request, urllib.parse, urllib.error

DROP = {"host", "content-length", "content-type", "accept-encoding", "connection", "if-none-match",
        "if-modified-since", "priority", "range", "cookie"}
SEND_URL = "https://labapi.healthray.com/api/v1/patient_case/send_wp_report"
BILL_URL = "https://node.healthray.com/api/v1/lab/get_lab_order_bill_status/{oid}?organization_id={org}"
CASES_URL = "https://labapi.healthray.com/api/v1/patient_case"


def slim(c):
    p = c.get("patient") or {}
    return {"id": c.get("id"), "order_id": c.get("healthray_order_id"), "order_no": c.get("healthray_lab_order_no"),
            "case_no": c.get("patient_case_no"), "name": p.get("patient_name") or p.get("first_name") or "",
            "cc": p.get("country_code") or "+91", "mobile": p.get("mobile_number") or "",
            "tests": c.get("investigations") or [], "registered": c.get("registered_at"),
            "shared": bool(c.get("is_report_shared"))}


def host_ok(url):
    u = urllib.parse.urlsplit(url or "")
    h = (u.hostname or "").lower()
    return u.scheme == "https" and (h == "healthray.com" or h.endswith(".healthray.com"))


def clean_headers(h):
    out = {k: str(v) for k, v in h.items()
           if k.lower() not in DROP and not k.startswith(":") and not k.lower().startswith("sec-")}
    out.setdefault("Accept", "application/json")
    out.setdefault("Origin", "https://lab.healthray.com")
    out.setdefault("Referer", "https://lab.healthray.com/")
    out.setdefault("User-Agent", "Mozilla/5.0")
    return out


def call(url, headers, data=None, method="GET", timeout=50):
    r = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(r, timeout=timeout) as resp:
            raw, code = resp.read().decode("utf-8", "ignore"), resp.status
    except urllib.error.HTTPError as e:
        raw, code = e.read().decode("utf-8", "ignore"), e.code
    try:
        body = json.loads(raw) if raw else {}
    except ValueError:
        body = {"message": raw[:300] or "Non-JSON response"}
    return code, body


def multipart(fields, fname, fbytes):
    b = "----PyForm" + uuid.uuid4().hex
    parts = [f'--{b}\r\nContent-Disposition: form-data; name="file"; filename="{fname}"\r\n'
             f'Content-Type: application/pdf\r\n\r\n'.encode(), fbytes, b"\r\n"]
    for k, v in fields:
        parts.append(f'--{b}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode())
    parts.append(f"--{b}--\r\n".encode())
    return b"".join(parts), f"multipart/form-data; boundary={b}"
