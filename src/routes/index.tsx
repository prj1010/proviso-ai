import AuthModal from "@/components/clause/AuthModal";
import HomePage from "@/components/clause/HomePage";
import { getAuthToken } from "@/lib/auth.util";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const navigate = useNavigate();
  const [authOpen, setAuthOpen] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    setAuthed(Boolean(getAuthToken()));
  }, []);

  return (
    <>
      <HomePage onOpenAuth={() => setAuthOpen(true)} isAuthenticated={authed} />
      <AuthModal
        isOpen={authOpen}
        onClose={() => setAuthOpen(false)}
        onSuccess={() => {
          setAuthOpen(false);
          setAuthed(true);
          void navigate({ to: "/dashboard/agreements" });
        }}
      />
    </>
  );
}
