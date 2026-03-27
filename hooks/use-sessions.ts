"use client";

import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";

export interface SessionSummary {
  id: string;
  createdAt: string;
  generationCount: number;
  previewUrl: string | null;
  firstPrompt: string | null;
}

export function useSessions() {
  const { data: session } = authClient.useSession();
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [isPending, setIsPending] = useState(false);

  async function fetchSessions() {
    setIsPending(true);
    fetch("/api/sessions")
      .then((r) => r.json())
      .then((data) => setSessions(data.sessions ?? []))
      .catch(() => setSessions([]))
      .finally(() => setIsPending(false));
  }

  useEffect(() => {
    if (!session?.user) {
      setSessions([]);
      return;
    }
    fetchSessions();
  }, [session?.user]);

  return { sessions, isPending, refresh: fetchSessions };
}
