import Dashboard from "@/components/clause/Dashboard";
import { clearAuth, getAuthToken } from "@/lib/auth.util";
import { authService, userService } from "@/services";
import type { UserProfile } from "@/services/user.service";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/dashboard")({
  component: DashboardRoute,
});

function DashboardRoute() {
  const navigate = useNavigate();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getAuthToken()) {
      void navigate({ to: "/" });
      return;
    }
    void userService.getProfile().then((res) => {
      if (!res.success || !res.data?.user) {
        clearAuth();
        void navigate({ to: "/" });
        return;
      }
      setUser(res.data.user);
      setReady(true);
    });
  }, [navigate]);

  if (!ready) {
    return (
      <div style={{ minHeight: "100vh", background: "#fff" }} />
    );
  }

  return (
    <Dashboard
      user={user}
      onLogout={() => {
        void authService.logout();
        clearAuth();
        void navigate({ to: "/" });
      }}
    />
  );
}
