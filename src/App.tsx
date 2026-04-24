import { Route, Routes, Navigate } from "react-router-dom";
import ErrorBoundary from "./components/ErrorBoundary";
import { Toaster } from "./components/ui/sonner";
import { ThemeProvider } from "./contexts/ThemeContext";
import { LeadsDashboard } from "./pages/LeadsDashboard";
import { LeadDetail } from "./pages/LeadDetail";
import { PipelineDashboard } from "./pages/PipelineDashboard";

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark" switchable={false}>
        <Toaster />
        <Routes>
          <Route path="/" element={<LeadsDashboard />} />
          <Route path="/lead/:id" element={<LeadDetail />} />
          <Route path="/pipeline" element={<PipelineDashboard />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
