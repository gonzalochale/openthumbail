"use client";

import { useRef, useState } from "react";
import { ArrowUp, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import { useThumbnailStore } from "@/store/use-thumbnail-store";
import { useShallow } from "zustand/react/shallow";
import { toast } from "sonner";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputActions,
  PromptInputAction,
} from "@/components/prompt";

export function GeneratePrompt() {
  const [prompt, setPrompt] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { versions, loading, setLoading, addVersion } = useThumbnailStore(
    useShallow((s) => ({
      versions: s.versions,
      loading: s.loading,
      setLoading: s.setLoading,
      addVersion: s.addVersion,
    })),
  );

  async function handleSubmit() {
    if (!prompt.trim() || loading) return;
    const trimmed = prompt.trim();
    setPrompt("");
    setLoading(true);

    const previousVersion = versions.length > 0 ? versions.at(-1) : undefined;

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: trimmed,
          previousVersion: previousVersion
            ? {
                imageBase64: previousVersion.imageBase64,
                mimeType: previousVersion.mimeType,
                enhancedPrompt: previousVersion.enhancedPrompt,
              }
            : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Unknown error");

      addVersion({
        imageBase64: data.image,
        mimeType: data.mimeType,
        enhancedPrompt: data.enhancedPrompt ?? null,
        prompt: trimmed,
        createdAt: Date.now(),
      });
    } catch (err) {
      toast(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
  }

  const placeholder =
    versions.length > 0
      ? "Describe changes for the next version…"
      : "Create a thumbnail for my YouTube video with the title...";

  return (
    <div className="fixed bottom-0 left-0 right-0 flex justify-center pb-10 sm:pb-20 px-5 pointer-events-none">
      <div className="w-full max-w-2xl pointer-events-auto">
        <PromptInput
          value={prompt}
          onValueChange={setPrompt}
          onSubmit={handleSubmit}
          isLoading={loading}
          disabled={loading}
        >
          <PromptInputTextarea ref={textareaRef} placeholder={placeholder} />
          <PromptInputActions className="justify-end px-1 pb-1">
            <PromptInputAction tooltip="Send">
              <Button
                onClick={handleSubmit}
                disabled={loading || !prompt.trim()}
                size="icon-lg"
              >
                <AnimatePresence mode="popLayout" initial={false}>
                  {loading ? (
                    <motion.span
                      key="loading"
                      initial={{ opacity: 0, scale: 0.5, rotate: -90 }}
                      animate={{ opacity: 1, scale: 1, rotate: 0 }}
                      exit={{ opacity: 0, scale: 0.5, rotate: 90 }}
                      transition={{ duration: 0.18, ease: [0.25, 1, 0.5, 1] }}
                    >
                      <Loader2 size={18} className="animate-spin" />
                    </motion.span>
                  ) : (
                    <motion.span
                      key="send"
                      initial={{ opacity: 0, scale: 0.5, rotate: 90 }}
                      animate={{ opacity: 1, scale: 1, rotate: 0 }}
                      exit={{ opacity: 0, scale: 0.5, rotate: -90 }}
                      transition={{ duration: 0.18, ease: [0.25, 1, 0.5, 1] }}
                    >
                      <ArrowUp size={18} />
                    </motion.span>
                  )}
                </AnimatePresence>
              </Button>
            </PromptInputAction>
          </PromptInputActions>
        </PromptInput>
      </div>
    </div>
  );
}
