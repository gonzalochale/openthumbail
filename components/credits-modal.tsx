"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { CREDIT_PLANS } from "@/lib/constants";
import { Zap } from "lucide-react";

interface CreditsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PLANS = [
  { credits: 30 },
  { credits: 100, popular: true },
  { credits: 500 },
] as const;


export function CreditsModal({ open, onOpenChange }: CreditsModalProps) {
  const router = useRouter();
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
      <DialogContent showCloseButton={false} className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">Get credits</DialogTitle>
          <p className="text-sm text-muted-foreground">
            1 credit = 1 thumbnail, bigger packs save more and prices will
            increase as we ship new features so grab a pack while the prices are
            low!
          </p>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          {PLANS.map((plan) => {
            const isLoading = loadingAmount === plan.credits;
            const isDisabled = loadingAmount !== null && !isLoading;
            const pricePerCredit = CREDIT_PLANS[plan.credits];
            const totalCents = plan.credits * pricePerCredit;
            const isPopular = "popular" in plan && plan.popular;

            return (
              <button
                key={plan.credits}
                onClick={() => handleBuy(plan.credits)}
                disabled={isDisabled}
                className={cn(
                  "cursor-pointer group relative flex items-center justify-between w-full px-4 py-3.5 rounded-xl border transition-all text-left outline-none",
                  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                  "disabled:pointer-events-none disabled:opacity-40",
                  loadingAmount === null && "hover:border-foreground/40",
                  isPopular
                    ? "border-foreground/20 bg-foreground/5 dark:bg-foreground/7"
                    : "border-border",
                  isLoading && "opacity-60",
                )}
              >
                {isPopular && (
                  <span className="absolute -top-1 right-3.5 flex items-center gap-1 rounded-full bg-foreground px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-background">
                    <Zap className="h-2.5 w-2.5" />
                    Most popular
                  </span>
                )}
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-semibold">
                    {plan.credits} credits
                  </span>
                  <span className="text-xs text-muted-foreground">
                    ${(pricePerCredit / 100).toFixed(2)} per credit
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold tabular-nums">
                    ${(totalCents / 100).toFixed(2)}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-muted-foreground text-center">
          Credits never expire
        </p>
      </DialogContent>
    </Dialog>
  );
}
