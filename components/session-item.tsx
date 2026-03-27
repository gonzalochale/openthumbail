"use client";

import { motion, useReducedMotion } from "motion/react";
import { useThumbnailStore } from "@/store/use-thumbnail-store";
import { useSidebar } from "@/components/ui/sidebar";
import type { SessionSummary } from "@/hooks/use-sessions";

interface SessionItemProps {
  session: SessionSummary;
  isNew?: boolean;
}

export function SessionItem({ session, isNew }: SessionItemProps) {
  const shouldReduceMotion = useReducedMotion();
  const activeSessionId = useThumbnailStore((s) => s.sessionId);
  const hasVersions = useThumbnailStore((s) => s.versions.length > 0);
  const loadSession = useThumbnailStore((s) => s.loadSession);
  const { isMobile, setOpenMobile } = useSidebar();
  const isActive =
    !!activeSessionId && activeSessionId === session.id && hasVersions;

  async function handleClick() {
    if (isActive) return;
    const res = await fetch(`/api/sessions/${session.id}`);
    if (!res.ok) return;
    const { generations } = await res.json();
    if (isMobile) setOpenMobile(false);
    loadSession(
      session.id,
      generations.map(
        (g: {
          id: string;
          prompt: string;
          rawPrompt: string | null;
          enhancedPrompt: string | null;
          imageUrl: string;
          mimeType: string;
          createdAt: string;
        }) => ({
          generationId: g.id,
          prompt: g.prompt,
          rawPrompt: g.rawPrompt,
          enhancedPrompt: g.enhancedPrompt,
          imageUrl: g.imageUrl,
          mimeType: g.mimeType,
          createdAt: new Date(g.createdAt).getTime(),
        }),
      ),
    );
  }

  return (
    <motion.button
      layout
      initial={shouldReduceMotion ? false : isNew ? { opacity: 0, y: -8 } : { opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: -6 }}
      transition={{
        duration: 0.2,
        ease: [0.25, 1, 0.5, 1],
        layout: { duration: 0.22, ease: [0.25, 1, 0.5, 1] },
      }}
      onClick={handleClick}
      className="group w-full flex items-center gap-2.5 rounded-md px-2.5 py-2 text-left cursor-pointer"
    >
      <div
        className="min-w-0 flex-1 overflow-hidden"
        style={{
          maskImage: "linear-gradient(to right, black 70%, transparent 100%)",
        }}
      >
        <span
          className={`block text-xs/relaxed font-medium whitespace-nowrap ${isActive ? "text-foreground" : "text-foreground/40"}`}
        >
          {session.firstPrompt ?? "Untitled session"}
        </span>
      </div>
    </motion.button>
  );
}
