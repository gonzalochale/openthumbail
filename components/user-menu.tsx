"use client";

import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { authClient } from "@/lib/auth-client";
import { motion } from "motion/react";

export function UserMenu() {
  const { data: session, isPending } = authClient.useSession();

  if (isPending || !session) return null;

  async function handleSignOut() {
    await authClient.signOut();
    window.location.reload();
  }

  return (
    <motion.header
      initial={{ opacity: 0, scale: 0.9, filter: "blur(5px)" }}
      animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
      transition={{
        duration: 0.3,
        type: "spring",
        stiffness: 300,
        damping: 20,
      }}
    >
      <Tooltip>
        <TooltipTrigger
          render={
            <Button variant="ghost" size="icon-lg" onClick={handleSignOut}>
              <LogOut className="size-3.5" />
            </Button>
          }
        />
        <TooltipContent>Sign out</TooltipContent>
      </Tooltip>
    </motion.header>
  );
}
