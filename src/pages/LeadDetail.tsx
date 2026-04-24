import { Navigate } from "react-router-dom";

// Redirect to main dashboard - detail is shown in a sheet
export function LeadDetail() {
  return <Navigate to="/" replace />;
}
