"use client";

import { useMemo, useState } from "react";
import { Eye, EyeOff, Trash2 } from "lucide-react";
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

export function GeminiKeyModal({ open, onOpenChange }: GeminiKeyModalProps) {
  const savedApiKey = useUserGeminiKeyStore((s) => s.apiKey);
  const setApiKey = useUserGeminiKeyStore((s) => s.setApiKey);
  const clearApiKey = useUserGeminiKeyStore((s) => s.clearApiKey);
  const [draft, setDraft] = useState("");
  const [visible, setVisible] = useState(false);
  const [isReplacing, setIsReplacing] = useState(false);

  const hasSavedKey = !!savedApiKey;
  const canSave = draft.trim().length > 0;

  const maskedSavedKey = useMemo(() => {
    if (!hasSavedKey) return "";
    if (savedApiKey.length <= 10) return "•".repeat(savedApiKey.length);
    return `${savedApiKey.slice(0, 4)}${"•".repeat(savedApiKey.length - 8)}${savedApiKey.slice(-4)}`;
  }, [hasSavedKey, savedApiKey]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Gemini API key</DialogTitle>
          <DialogDescription>
            Your key is stored only in this browser via localStorage.
          </DialogDescription>
        </DialogHeader>
        {(!hasSavedKey || isReplacing) && (
          <div className="flex items-center gap-2">
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
              {visible ? (
                <EyeOff className="size-3.5" />
              ) : (
                <Eye className="size-3.5" />
              )}
            </Button>
          </div>
        )}
        <DialogFooter className="gap-2">
          {hasSavedKey && !isReplacing ? (
            <>
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
            </>
          ) : (
            <>
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
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
