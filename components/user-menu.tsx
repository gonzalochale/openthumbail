"use client";

import { ChevronsUpDown, Wallet, Info } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { authClient } from "@/lib/auth-client";
import { useThumbnailStore } from "@/store/use-thumbnail-store";
import { SignOutButton } from "@/components/sign-out-button";
import { LoginButton } from "@/components/login-button";

export function UserMenu() {
  const { data: session, isPending } = authClient.useSession();
  const openCreditsModal = useThumbnailStore((s) => s.openCreditsModal);
  const openInfoModal = useThumbnailStore((s) => s.openInfoModal);
  const shouldReduceMotion = useReducedMotion();
  const user = session?.user;

  const variants = {
    initial: shouldReduceMotion ? {} : { opacity: 0, y: 4 },
    animate: { opacity: 1, y: 0 },
    exit: shouldReduceMotion ? {} : { opacity: 0, y: -4 },
  };

  const transition = { duration: 0.2, ease: [0.25, 1, 0.5, 1] };

  return (
    <AnimatePresence mode="popLayout" initial={false}>
      {isPending ? null : !user ? (
        <motion.div
          key="logged-out"
          variants={variants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={transition}
          className="flex flex-col gap-2"
        >
          <div className="flex flex-col gap-0.5">
            <span className="text-xs/relaxed font-medium">
              Generate AI thumbnails
            </span>
            <span className="text-xs/relaxed text-muted-foreground">
              Sign in to start creating and saving your sessions.
            </span>
          </div>
          <LoginButton className="w-full" />
        </motion.div>
      ) : (
        <motion.div
          key="logged-in"
          variants={variants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={transition}
        >
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <SidebarMenuButton
                      size="lg"
                      className="hover:cursor-pointer data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                    >
                      <Avatar size="sm">
                        <AvatarImage
                          src={user.image ?? undefined}
                          alt={user.name ?? ""}
                        />
                        <AvatarFallback>
                          {user.name?.charAt(0).toUpperCase() ?? "?"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col gap-0.5 leading-none min-w-0">
                        <span className="font-medium truncate">
                          {user.name ?? "—"}
                        </span>
                        <span className="text-xs text-muted-foreground truncate">
                          {user.email ?? ""}
                        </span>
                      </div>
                      <ChevronsUpDown className="ml-auto shrink-0" />
                    </SidebarMenuButton>
                  }
                />
                <DropdownMenuContent
                  className="w-(--anchor-width)"
                  align="start"
                  side="top"
                >
                  <DropdownMenuItem onClick={openCreditsModal}>
                    <Wallet />
                    Get credits
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={openInfoModal}>
                    <Info />
                    About us
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <SignOutButton />
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
