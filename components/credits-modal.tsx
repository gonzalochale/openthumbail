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
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { CREDIT_UNIT_AMOUNT_CENTS } from "@/lib/constants";
import { Sparkle } from "lucide-react";

interface CreditsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PLANS = [
  { credits: 25 },
  { credits: 50, popular: true },
  { credits: 100 },
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
      <DialogContent showCloseButton={false} className="max-w-90">
        <DialogHeader>
          <DialogTitle>Add credits</DialogTitle>
          <DialogDescription>
            Each generation costs 1 credit, the pricing will increase in the
            future as we add more features so grab a pack now!
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
                      <Badge>
                        <Sparkle className="w-3 h-3" />
                        Popular
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="text-sm font-semibold tabular-nums">
                    $
                    {((plan.credits * CREDIT_UNIT_AMOUNT_CENTS) / 100).toFixed(
                      2,
                    )}
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
