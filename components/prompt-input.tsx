"use client";

import { useState, KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useThumbnailStore } from "@/store/use-thumbnail-store";
import { useShallow } from "zustand/react/shallow";
import { ArrowUp } from "lucide-react";
import { toast } from "sonner";

export function PromptInput() {
  const [prompt, setPrompt] = useState("");
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
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  const placeholder =
    versions.length > 0
      ? "Describe changes for the next version…"
      : "A vibrant thumbnail for a cooking channel, bold title text 'Best Pasta Ever'…";

  return (
    <div className="fixed bottom-0 left-0 right-0 flex justify-center pb-10 sm:pb-20 px-5 pointer-events-none">
      <div className="relative w-full max-w-2xl pointer-events-auto flex flex-col gap-2">
        <Textarea
          placeholder={placeholder}
          rows={2}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          className="relative resize-none rounded-2xl p-5 dark:bg-card min-h-32 max-h-44 pr-14"
        />
        <Button
          onClick={handleSubmit}
          disabled={loading || !prompt.trim()}
          size="icon-lg"
          className="absolute right-5 bottom-5"
        >
          <ArrowUp />
        </Button>
      </div>
    </div>
  );
}
