"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useThumbnailStore } from "@/store/use-thumbnail-store";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

interface CreditsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PLANS = [
  { credits: 10, price: 2.5 },
  { credits: 25, price: 6.25 },
  { credits: 50, price: 12.5, popular: true },
  { credits: 100, price: 25 },
] as const;

export function CreditsModal({ open, onOpenChange }: CreditsModalProps) {
  const router = useRouter();
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
      if (url) router.push(url);
    } catch {
      setLoadingAmount(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="max-w-90">
        <DialogHeader>
          <DialogTitle>Add credits</DialogTitle>
          <DialogDescription>
            {credits !== null ? (
              <>
                You have{" "}
                <strong className="text-foreground font-medium">
                  {credits}
                </strong>{" "}
                credit{credits !== 1 ? "s" : ""}.{" "}
              </>
            ) : null}
            Each generation costs 1 credit.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          {PLANS.map((plan) => {
            const isLoading = loadingAmount === plan.credits;
            return (
              <button
                key={plan.credits}
                onClick={() => handleBuy(plan.credits)}
                disabled={loadingAmount !== null && !isLoading}
                className={cn(
                  "hover:cursor-pointer group flex items-center justify-between w-full px-4 py-3.5 rounded-lg border transition-all text-left outline-none",
                  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                  "disabled:pointer-events-none",
                  "popular" in plan
                    ? "border-foreground/12 bg-foreground/4 dark:bg-foreground/7"
                    : "border-border hover:bg-muted/50 hover:border-foreground/10",
                  isLoading && "opacity-50",
                )}
              >
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {plan.credits} credits
                    </span>
                    {"popular" in plan && plan.popular && (
                      <Badge>popular</Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="text-sm font-semibold tabular-nums">
                    ${plan.price.toFixed(2)}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-muted-foreground text-center">
          Credits never expire, secure checkout via Stripe
        </p>
      </DialogContent>
    </Dialog>
  );
}
