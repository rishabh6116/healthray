import { NavLink } from "react-router-dom";

// The navigation strip that sits at the top of the page (the highlighted slot in the screenshot).
export default function TopNav() {
  return (
    <nav className="tnav" aria-label="Pages">
      <NavLink to="/" end className={({ isActive }) => (isActive ? "active" : "")}>
        <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M16 13H8M16 17H8" /></svg>
        Lab Orders
      </NavLink>
      <NavLink to="/patients" className={({ isActive }) => (isActive ? "active" : "")}>
        <svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>
        Patients
      </NavLink>
      <NavLink to="/send-report" className={({ isActive }) => (isActive ? "active" : "")}>
        <svg viewBox="0 0 24 24"><path d="M21 11.5a8.4 8.4 0 0 1-12.5 7.3L3 20l1.3-5.3A8.5 8.5 0 1 1 21 11.5z" /></svg>
        Send Report
      </NavLink>
    </nav>
  );
}
