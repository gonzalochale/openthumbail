"use client";

import { useMemo, useState } from "react";
import { Eye, EyeOff, Trash2 } from "lucide-react";
import { AnimatePresence, m, useReducedMotion } from "motion/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useUserGeminiKeyStore } from "@/store/use-user-gemini-key-store";

interface GeminiKeyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const EASE = [0.25, 1, 0.5, 1] as const;

export function GeminiKeyModal({ open, onOpenChange }: GeminiKeyModalProps) {
  const savedApiKey = useUserGeminiKeyStore((s) => s.apiKey);
  const setApiKey = useUserGeminiKeyStore((s) => s.setApiKey);
  const clearApiKey = useUserGeminiKeyStore((s) => s.clearApiKey);
  const [draft, setDraft] = useState("");
  const [visible, setVisible] = useState(false);
  const [isReplacing, setIsReplacing] = useState(false);
  const rm = useReducedMotion();

  const hasSavedKey = !!savedApiKey;
  const canSave = draft.trim().length > 0;

  const maskedSavedKey = useMemo(() => {
    if (!hasSavedKey) return "";
    if (savedApiKey.length <= 10) return "•".repeat(savedApiKey.length);
    return `${savedApiKey.slice(0, 4)}${"•".repeat(savedApiKey.length - 8)}${savedApiKey.slice(-4)}`;
  }, [hasSavedKey, savedApiKey]);

  const slideVariants = {
    initial: rm ? { opacity: 0 } : { opacity: 0, y: 6 },
    animate: rm ? { opacity: 1 } : { opacity: 1, y: 0 },
    exit: rm ? { opacity: 0 } : { opacity: 0, y: -6 },
  };
  const transition = { duration: 0.15, ease: EASE };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Gemini API key</DialogTitle>
          <DialogDescription>
            Your key is stored only in this browser via localStorage.
          </DialogDescription>
        </DialogHeader>
        <AnimatePresence mode="wait">
          {hasSavedKey && !isReplacing ? (
            <m.div
              key="saved"
              variants={slideVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={transition}
              className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2"
            >
              <span className="font-mono text-xs text-muted-foreground flex-1 tracking-widest truncate">
                {maskedSavedKey}
              </span>
            </m.div>
          ) : (
            <m.div
              key="input"
              variants={slideVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={transition}
              className="flex items-center gap-2"
            >
              <Input
                id="user-gemini-key"
                type={visible ? "text" : "password"}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                placeholder="AIza..."
              />
              <Button
                type="button"
                size="icon-sm"
                variant="outline"
                onClick={() => setVisible((v) => !v)}
                aria-label={visible ? "Hide key" : "Show key"}
              >
                <AnimatePresence mode="wait">
                  {visible ? (
                    <m.span
                      key="hide"
                      initial={rm ? false : { opacity: 0, scale: 0.6 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={rm ? undefined : { opacity: 0, scale: 0.6 }}
                      transition={{ duration: 0.12, ease: EASE }}
                    >
                      <EyeOff className="size-3.5" />
                    </m.span>
                  ) : (
                    <m.span
                      key="show"
                      initial={rm ? false : { opacity: 0, scale: 0.6 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={rm ? undefined : { opacity: 0, scale: 0.6 }}
                      transition={{ duration: 0.12, ease: EASE }}
                    >
                      <Eye className="size-3.5" />
                    </m.span>
                  )}
                </AnimatePresence>
              </Button>
            </m.div>
          )}
        </AnimatePresence>
        <DialogFooter className="gap-2">
          <AnimatePresence mode="wait">
            {hasSavedKey && !isReplacing ? (
              <m.div
                key="manage-footer"
                variants={slideVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={transition}
                className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end w-full"
              >
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    clearApiKey();
                    setDraft("");
                    setVisible(false);
                    setIsReplacing(false);
                  }}
                >
                  <Trash2 className="size-3.5" />
                  Remove key
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    setIsReplacing(true);
                    setDraft("");
                    setVisible(false);
                  }}
                >
                  Replace key
                </Button>
              </m.div>
            ) : (
              <m.div
                key="input-footer"
                variants={slideVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={transition}
                className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end w-full"
              >
                {hasSavedKey ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsReplacing(false);
                      setDraft("");
                      setVisible(false);
                    }}
                  >
                    Cancel
                  </Button>
                ) : null}
                <Button
                  type="button"
                  disabled={!canSave}
                  onClick={() => {
                    setApiKey(draft);
                    setDraft("");
                    setVisible(false);
                    setIsReplacing(false);
                  }}
                >
                  Save key
                </Button>
              </m.div>
            )}
          </AnimatePresence>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
