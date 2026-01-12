import { createFileRoute } from '@tanstack/react-router';
import { Navigate } from '@tanstack/react-router';

export const Route = createFileRoute('/')({
  component: RedirectToDashboard,
});

function RedirectToDashboard() {
  return <Navigate to="/dashboard" />;
}
