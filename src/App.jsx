import { Routes, Route, Navigate } from "react-router-dom";
import LabOrders from "./pages/LabOrders.jsx";
import SendReport from "./pages/SendReport.jsx";
import Patients from "./pages/Patients.jsx";
import ConfirmHost from "./components/ConfirmHost.jsx";

export default function App() {
  return (
    <>
    <Routes>
      <Route path="/" element={<LabOrders />} />
      <Route path="/send-report" element={<SendReport />} />
      <Route path="/patients" element={<Patients />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    <ConfirmHost />
    </>
  );
}
