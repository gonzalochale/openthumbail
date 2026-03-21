"use client";

import { useState } from "react";
import { LogOut, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { authClient } from "@/lib/auth-client";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { useCredits } from "@/hooks/use-credits";
import { useThumbnailStore } from "@/store/use-thumbnail-store";
import { CreditsModal } from "@/components/credits-modal";
import { GitHubSignInButton } from "@/components/github-sign-in-button";
import NumberFlow from "@number-flow/react";
import { useRouter } from "next/navigation";

export function UserMenu() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [creditsOpen, setCreditsOpen] = useState(false);

  useCredits();
  const credits = useThumbnailStore((s) => s.credits);

  async function handleSignOut() {
    await authClient.signOut();
    router.refresh();
  }

  const springTransition = {
    type: "spring",
    bounce: 0,
    duration: 0.6,
  } as const;
  const motionProps = {
    initial: { opacity: 0, filter: "blur(5px)" },
    animate: { opacity: 1, filter: "blur(0px)" },
    exit: { opacity: 0, filter: "blur(5px)" },
    transition: springTransition,
  };

  return (
    <>
      <AnimatePresence mode="wait">
        {!isPending && !session && (
          <motion.header
            key="unauthenticated"
            className="w-full flex items-center justify-end"
            {...motionProps}
          >
            <GitHubSignInButton />
          </motion.header>
        )}
        {!isPending && session && (
          <LayoutGroup key="authenticated">
            <motion.header
              layout
              className="w-full flex items-center justify-end gap-2"
              {...motionProps}
              transition={{
                layout: springTransition,
                default: springTransition,
              }}
            >
              <motion.div layout transition={springTransition}>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        variant="secondary"
                        size="lg"
                        className="min-w-24 justify-between gap-5"
                        onClick={() => setCreditsOpen(true)}
                      >
                        Credits
                        <NumberFlow value={credits ?? 0} />
                      </Button>
                    }
                  />
                  <TooltipContent>Add credits</TooltipContent>
                </Tooltip>
              </motion.div>
              <motion.div layout transition={springTransition}>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        variant="destructive"
                        size="icon-lg"
                        onClick={handleSignOut}
                      >
                        <LogOut className="size-3.5" />
                      </Button>
                    }
                  />
                  <TooltipContent>Sign out</TooltipContent>
                </Tooltip>
              </motion.div>
            </motion.header>
          </LayoutGroup>
        )}
      </AnimatePresence>
      <CreditsModal open={creditsOpen} onOpenChange={setCreditsOpen} />
    </>
  );
}
