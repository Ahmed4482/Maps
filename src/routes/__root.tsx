import { createRootRoute, Outlet } from "@tanstack/react-router";
import { Header } from "@/components/layout/Header";

export const Route = createRootRoute({
  component: () => (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="relative z-0">
        <Outlet />
      </main>
    </div>
  ),
});
