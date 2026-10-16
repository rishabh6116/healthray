export const esc = (s) => (s == null ? "" : String(s));
export const money = (n) => "₹" + Number(n || 0).toLocaleString("en-IN");
export const ist = (d) =>
  d
    ? new Date(d).toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
      })
    : "";
export const nm = (p) => (p ? [p.title, p.first_name, p.middle_name, p.last_name].filter(Boolean).join(" ").trim() : "");
export const addr = (a) => (a ? [a.house_no, a.street_address, a.address, a.city, a.state, a.zipcode].filter(Boolean).join(", ") : "");
export const pname = (o) => nm(o.patient);
export const tests = (o) => o.orders || [];
export const total = (o) => tests(o).reduce((s, t) => s + (+t.price || 0), 0);
export const pad = (n) => String(n).padStart(2, "0");
export const iso = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;
export const isoOf = (d) => iso(d.getFullYear(), d.getMonth(), d.getDate());
export const lbl = (i) =>
  i ? new Date(i + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "";
export const MN = ["January","February","March","April","May","June","July","August","September","October","November","December"];
export const uniq = (a) => [...new Set(a.filter((x) => x != null && x !== ""))];
export const pretty = (v) => String(v).replace(/_/g, " ");
export const kb = (n) => (n > 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.round(n / 1024) + " KB");

export function shift(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return isoOf(d);
}

export const jget = (k, d) => {
  try { return JSON.parse(localStorage.getItem(k) || "null") || d; } catch { return d; }
};
export const ssGet = (k) => {
  try { return JSON.parse(sessionStorage.getItem(k) || "null"); } catch { return null; }
};
export const ssSet = (k, v) => {
  try { sessionStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; }
};
