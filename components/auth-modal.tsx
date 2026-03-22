"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { GitHubSignInButton } from "@/components/github-sign-in-button";

interface AuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AuthModal({ open, onOpenChange }: AuthModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="max-w-xs">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">Welcome</DialogTitle>
          <DialogDescription>
            Please sign in with GitHub to continue
          </DialogDescription>
        </DialogHeader>
        <GitHubSignInButton className="w-full mt-2" />
      </DialogContent>
    </Dialog>
  );
}
