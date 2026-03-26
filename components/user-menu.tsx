"use client";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { authClient } from "@/lib/auth-client";
import { useThumbnailStore } from "@/store/use-thumbnail-store";
import NumberFlow from "@number-flow/react";
import { InfoModal } from "@/components/info-modal";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Skeleton } from "./ui/skeleton";

export function UserMenu() {
  const { data: session, isPending } = authClient.useSession();
  const credits = useThumbnailStore((s) => s.credits);
  const openCreditsModal = useThumbnailStore((s) => s.openCreditsModal);
  const openAuthModal = useThumbnailStore((s) => s.openAuthModal);

  return (
    <header className="w-full flex items-center justify-between gap-2">
      <SidebarTrigger />
      <div className="flex items-center gap-2">
        <InfoModal />
        {isPending ? (
          <Skeleton className="w-28 h-8" />
        ) : session ? (
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
        ) : (
          <Button
            size="lg"
            variant="outline"
            className="w-28"
            onClick={openAuthModal}
          >
            Log in
          </Button>
        )}
      </div>
    </header>
  );
}
