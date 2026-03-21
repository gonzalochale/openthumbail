"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useThumbnailStore } from "@/store/use-thumbnail-store";

interface CreditsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const AMOUNTS = [10, 25, 50, 100] as const;

export function CreditsModal({ open, onOpenChange }: CreditsModalProps) {
  const credits = useThumbnailStore((s) => s.credits);
  const [loadingAmount, setLoadingAmount] = useState<number | null>(null);

  async function handleBuy(amount: number) {
    setLoadingAmount(amount);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credits: amount }),
      });
      if (!res.ok) throw new Error("Failed to create checkout");
      const { url } = await res.json();
      if (url) window.location.href = url;
    } catch {
      setLoadingAmount(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">
            Add credits
          </DialogTitle>
          <DialogDescription>
            {credits !== null ? (
              <>
                You have <strong>{credits}</strong> credit
                {credits !== 1 ? "s" : ""}.{" "}
              </>
            ) : null}
            , each generation costs 1 credit.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2 mt-2">
          {AMOUNTS.map((amount) => (
            <Button
              key={amount}
              variant="outline"
              className="flex flex-col h-auto py-3 gap-0.5"
              onClick={() => handleBuy(amount)}
              disabled={loadingAmount !== null}
            >
              <span className="font-semibold">+{amount} credits</span>
              <span className="text-xs text-muted-foreground">
                ${(amount * 0.25).toFixed(2)}
              </span>
            </Button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground text-center mt-1">
          credits never expire
        </p>
      </DialogContent>
    </Dialog>
  );
}
