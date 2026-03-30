"use client";

import { useState } from "react";
import { m, AnimatePresence, useReducedMotion } from "motion/react";
import { Trash2 } from "lucide-react";
import { useCameoStore } from "@/store/use-cameo-store";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

interface CameoManageProps {
  onClose: () => void;
}

const EASE_OUT = [0.25, 1, 0.5, 1] as const;
const SPRING_BTN = { type: "spring" as const, stiffness: 500, damping: 30 };

export function CameoManage({ onClose }: CameoManageProps) {
  const setRegistered = useCameoStore((s) => s.setRegistered);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const rm = useReducedMotion();

  async function handleDelete() {
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch("/api/cameo", { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      setRegistered(false);
      onClose();
    } catch {
      setDeleteError("Could not delete. Try again.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <AnimatePresence>
        {deleteError && (
          <m.p
            initial={rm ? (false as const) : { opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15, ease: EASE_OUT }}
            className="text-xs text-destructive text-center"
          >
            {deleteError}
          </m.p>
        )}
      </AnimatePresence>
      <m.div className="w-full flex gap-2 pt-1 justify-end">
        <m.button
          onClick={handleDelete}
          disabled={deleting}
          transition={SPRING_BTN}
          className={cn(buttonVariants({ variant: "outline" }), "")}
        >
          <Trash2 size={14} />
          Delete Cameo
        </m.button>
      </m.div>
    </div>
  );
}
