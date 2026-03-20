"use client";

import { useState } from "react";
import { Controls } from "./controls";
import { Preview } from "./preview";

export function Generator() {
  const [apiKey, setApiKey] = useState("");
  const [prompt, setPrompt] = useState("");
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [enhancedPrompt, setEnhancedPrompt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    setImageBase64(null);
    setEnhancedPrompt(null);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey, prompt }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Unknown error");
      }

      setImageBase64(data.image);
      setEnhancedPrompt(data.enhancedPrompt ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  function handleDownload() {
    if (!imageBase64) return;
    const a = document.createElement("a");
    a.href = `data:image/png;base64,${imageBase64}`;
    a.download = "thumbnail.png";
    a.click();
  }

  return (
    <>
      <Controls
        apiKey={apiKey}
        prompt={prompt}
        loading={loading}
        error={error}
        hasImage={!!imageBase64}
        onApiKeyChange={setApiKey}
        onPromptChange={setPrompt}
        onGenerate={handleGenerate}
        onDownload={handleDownload}
      />
      <Preview
        imageBase64={imageBase64}
        enhancedPrompt={enhancedPrompt}
        loading={loading}
      />
    </>
  );
}
