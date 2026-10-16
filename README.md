# Healthray Lab (React + Vite, Python API on Vercel)

Pages
- `/`             Lab Orders (same as before)
- `/send-report`  Send Report (port of send_report_tool.py)
- `/patients`     Patients (port of healthray_patients_find.py; paste cURL once)

Top nav (Lab Orders | Patients | Send Report) sits at the top of every page: `src/components/TopNav.jsx`

Login tokens: entered once in the sidebar footer (`src/components/CredentialsPanel.jsx`, store in `src/lib/auth.js`);
all pages read them from there. Saved only in this browser (localStorage `hrAuth`).

API (Vercel Python functions in /api): fetch.py, bill.py, cases.py, send.py, patients.py (+ _hr.py helpers)

Deploy: push to the repo, Vercel auto-detects Vite (build: `npm run build`, output: `dist`).
Local (two terminals): `npm i && npm run dev` (starts the Vite frontend and `dev_api.py` on :3000 together; needs Python).
`vercel dev` also works (dev_api.py is skipped when :3000 is already in use).
Limit: Vercel request body is ~4.5 MB, so keep report PDFs under ~3 MB.
