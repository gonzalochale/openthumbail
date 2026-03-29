"use client";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { authClient } from "@/lib/auth/client";
import { useThumbnailStore } from "@/store/use-thumbnail-store";
import { useThumbnailUIStore } from "@/store/use-thumbnail-ui-store";
import NumberFlow from "@number-flow/react";
import { Info, KeyRound } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { LoginButton } from "@/components/auth/login-button";

export function UserHeader() {
  const { data: session, isPending } = authClient.useSession();
  const credits = useThumbnailStore((s) => s.credits);
  const openCreditsModal = useThumbnailUIStore((s) => s.openCreditsModal);
  const openInfoModal = useThumbnailUIStore((s) => s.openInfoModal);
  const openGeminiKeyModal = useThumbnailUIStore((s) => s.openGeminiKeyModal);

  return (
    <header className="w-full flex items-center justify-between gap-2">
      <SidebarTrigger />
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon-lg" onClick={openInfoModal}>
          <Info />
        </Button>
        {isPending ? (
          <>
            <Skeleton className="size-8" />
            <Skeleton className="w-28 h-8" />
          </>
        ) : session ? (
          <>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="outline"
                    size="icon-lg"
                    onClick={openGeminiKeyModal}
                  >
                    <KeyRound />
                  </Button>
                }
              />
              <TooltipContent>Gemini API key</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="outline"
                    size="lg"
                    className="w-28 justify-between gap-5"
                    onClick={openCreditsModal}
                  >
                    Credits
                    <NumberFlow value={credits ?? 0} />
                  </Button>
                }
              />
              <TooltipContent>Add credits</TooltipContent>
            </Tooltip>
          </>
        ) : (
          <LoginButton />
        )}
      </div>
    </header>
  );
}
