"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { UserMenu } from "@/components/user-menu";
import { SessionItem } from "@/components/session-item";
import { authClient } from "@/lib/auth-client";
import { useThumbnailStore } from "@/store/use-thumbnail-store";
import { useSessions } from "@/hooks/use-sessions";
import {
  animate,
  AnimatePresence,
  motion,
  useReducedMotion,
} from "motion/react";
import type { AnimationPlaybackControls } from "motion/react";

export function SessionsSidebar() {
  const { data: session, isPending: authPending } = authClient.useSession();
  const { isMobile, setOpenMobile } = useSidebar();
  const openAuthModal = useThumbnailStore((s) => s.openAuthModal);
  const clear = useThumbnailStore((s) => s.clear);
  const clearHistory = useThumbnailStore((s) => s.clearHistory);
  const focusPrompt = useThumbnailStore((s) => s.focusPrompt);
  const firstGenerationId = useThumbnailStore(
    (s) => s.versions[0]?.generationId,
  );
  const { sessions, refresh } = useSessions();
  const prevFirstIdRef = useRef<string | null>(null);
  const [newSessionId, setNewSessionId] = useState<string | null>(null);
  const hasUser = !!session?.user;
  const prevHasUserRef = useRef(hasUser);

  useEffect(() => {
    if (prevHasUserRef.current && !hasUser && !authPending) {
      clearHistory();
    }
    prevHasUserRef.current = hasUser;
  }, [hasUser, authPending]);

  useEffect(() => {
    const firstId = sessions[0]?.id ?? null;
    const isNew =
      firstId !== null &&
      firstId !== prevFirstIdRef.current &&
      prevFirstIdRef.current !== null;
    prevFirstIdRef.current = firstId;
    if (!isNew) return;
    setNewSessionId(firstId);
    const t = setTimeout(() => setNewSessionId(null), 300);
    return () => clearTimeout(t);
  }, [sessions]);

  useEffect(() => {
    if (!firstGenerationId) return;
    refresh();
  }, [firstGenerationId]);
  const shouldReduceMotion = useReducedMotion();
  const footerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<AnimationPlaybackControls | null>(null);

  function handleNewSession() {
    if (!session) return openAuthModal();
    clear();
    focusPrompt();
    if (isMobile) setOpenMobile(false);
  }

  useLayoutEffect(() => {
    const el = footerRef.current;
    if (!el || shouldReduceMotion) return;

    const from = el.offsetHeight;
    el.style.height = "auto";
    const to = el.scrollHeight;
    el.style.height = `${from}px`;

    animRef.current?.stop();
    animRef.current = animate(
      el,
      { height: to },
      { duration: 0.22, ease: [0.25, 1, 0.5, 1] },
    );
  }, [session?.user, authPending, shouldReduceMotion]);

  return (
    <Sidebar>
      <SidebarHeader className="border-b">
        <h1 className="h-8 text-xs/relaxed font-medium whitespace-nowrap px-2.5 select-none flex items-center">
          Sessions
        </h1>
      </SidebarHeader>
      <SidebarContent className="flex flex-col min-h-0">
        <div className="p-2 shrink-0">
          <Button
            variant="outline"
            size="lg"
            className="w-full"
            onClick={handleNewSession}
          >
            <Plus />
            New session
          </Button>
        </div>
        <AnimatePresence initial={false}>
          {session?.user && (
            <motion.div
              key="sessions-list"
              initial={
                shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: -6 }
              }
              animate={{ opacity: 1, x: 0 }}
              exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: -6 }}
              transition={{ duration: 0.2, ease: [0.25, 1, 0.5, 1] }}
              className="flex-1 min-h-0 overflow-hidden"
            >
              <ScrollArea className="h-full">
                <motion.div layout className="px-2 pb-2 flex flex-col gap-0.5">
                  <AnimatePresence initial={false} mode="popLayout">
                    {sessions.map((s) => (
                      <SessionItem
                        key={s.id}
                        session={s}
                        isNew={s.id === newSessionId}
                      />
                    ))}
                  </AnimatePresence>
                </motion.div>
              </ScrollArea>
            </motion.div>
          )}
        </AnimatePresence>
      </SidebarContent>
      <SidebarFooter className="border-t overflow-hidden p-0 select-none">
        <div ref={footerRef}>
          <div className="p-2">
            <UserMenu />
          </div>
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
