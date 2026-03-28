"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowUp, Paperclip } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { useThumbnailStore } from "@/store/use-thumbnail-store";
import { useShallow } from "zustand/react/shallow";
import { toast } from "sonner";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputActions,
  PromptInputAction,
} from "@/components/prompt";
import {
  FileUpload,
  FileUploadTrigger,
  FileUploadContent,
} from "@/components/file-upload";
import { authClient } from "@/lib/auth-client";
import { randomItem, resizeAndToBase64 } from "@/lib/utils";
import { MAX_PROMPT_LENGTH, PROMPT_PLACEHOLDERS } from "@/lib/constants";
import {
  type ChannelReference,
  isFoundVideoChip,
  stripVideoChips,
  youtubeRe,
  ytThumbnailUrl,
} from "@/lib/youtube";
import { getTextSegments } from "@/lib/text-segments";
import { useThumbnailShortcuts } from "@/hooks/use-thumbnail-shortcuts";
import { useYouTubeReferences } from "@/hooks/use-youtube-references";
import { PromptTextOverlay } from "@/components/prompt-text-overlay";
import { FileChipList, type FileEntry } from "@/components/file-chip-list";

export function GeneratePrompt() {
  useThumbnailShortcuts();
  const shouldReduceMotion = useReducedMotion();
  const [prompt, setPrompt] = useState("");
  const lastSubmittedPromptRef = useRef<string | null>(null);
  const [randomPlaceholder] = useState(() => randomItem(PROMPT_PLACEHOLDERS));
  const [fileEntries, setFileEntries] = useState<FileEntry[]>([]);
  const [pendingDeleteFile, setPendingDeleteFile] = useState(false);
  const [pendingDeleteVideoId, setPendingDeleteVideoId] = useState<
    string | null
  >(null);
  const [fileHoverOpen, setFileHoverOpen] = useState<boolean | undefined>(
    false,
  );
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const pendingActionRef = useRef<"submit" | "attach" | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const { data: session, isPending: sessionPending } = authClient.useSession();
  const {
    versions,
    selectedVersionId,
    sessionId,
    loading,
    setLoading,
    startGenerating,
    addVersion,
    setSessionId,
    pendingPrompt,
    setPendingPrompt,
    decrementCredits,
    openAuthModal,
    openCreditsModal,
    promptFocusTick,
    clearTick,
  } = useThumbnailStore(
    useShallow((s) => ({
      versions: s.versions,
      selectedVersionId: s.selectedVersionId,
      sessionId: s.sessionId,
      loading: s.loading,
      setLoading: s.setLoading,
      startGenerating: s.startGenerating,
      addVersion: s.addVersion,
      setSessionId: s.setSessionId,
      pendingPrompt: s.pendingPrompt,
      setPendingPrompt: s.setPendingPrompt,
      decrementCredits: s.decrementCredits,
      openAuthModal: s.openAuthModal,
      openCreditsModal: s.openCreditsModal,
      promptFocusTick: s.promptFocusTick,
      clearTick: s.clearTick,
    })),
  );

  useEffect(() => {
    if (promptFocusTick === 0) return;
    requestAnimationFrame(() => textareaRef.current?.focus());
  }, [promptFocusTick]);

  const { channelWidgets, videoChips, processValueChange, clearAll } =
    useYouTubeReferences({
      onVideoTitleResolved: (originalUrl, title) => {
        setPrompt((prev) => prev.replace(originalUrl, title));
      },
      isAuthenticated: !!session,
      onAuthRequired: () => openAuthModal(),
    });

  useEffect(() => {
    if (clearTick === 0) return;
    setPrompt("");
    setFileEntries([]);
    clearAll();
  }, [clearTick, clearAll]);

  function addFiles(newFiles: File[]) {
    if (!session) {
      pendingActionRef.current = "attach";
      openAuthModal();
      return;
    }
    if (selectedVersionId !== null) return;
    if (newFiles.length === 0) return;
    const prev = fileEntries[0];
    if (prev) URL.revokeObjectURL(prev.url);
    setFileEntries([
      { file: newFiles[0], url: URL.createObjectURL(newFiles[0]) },
    ]);
  }

  function removeFile(index: number) {
    setFileHoverOpen(false);
    setTimeout(() => {
      setFileEntries((prev) => {
        URL.revokeObjectURL(prev[index].url);
        return prev.filter((_, i) => i !== index);
      });
      setFileHoverOpen(undefined);
    }, 130);
  }

  const handleValueChange = useCallback(
    (value: string) => {
      const processed = processValueChange(value);
      setPrompt(processed);
      if (pendingPrompt !== null) setPendingPrompt(processed.trim() || null);
      if (pendingDeleteFile) setPendingDeleteFile(false);
      if (pendingDeleteVideoId) setPendingDeleteVideoId(null);
    },
    [
      processValueChange,
      pendingPrompt,
      setPendingPrompt,
      pendingDeleteFile,
      pendingDeleteVideoId,
    ],
  );

  const textSegments = useMemo(
    () =>
      /@/.test(prompt) ||
      /youtu/.test(prompt) ||
      videoChips.some((c) => c.stage === "found")
        ? getTextSegments(prompt, channelWidgets, videoChips)
        : null,
    [prompt, channelWidgets, videoChips],
  );

  const doSubmit = useCallback(
    async (promptValue: string) => {
      if (!promptValue.trim() || loading) return;
      const trimmed = promptValue.trim();
      const videoChipsSnapshot = videoChips;

      const validationPrompt = stripVideoChips(
        trimmed.replace(/@[\w.-]*/g, ""),
        videoChipsSnapshot,
      );
      if (!validationPrompt) return;

      const sendPrompt = trimmed
        .replace(youtubeRe(), "")
        .replace(/\s{2,}/g, " ")
        .trim();

      const videoRefs = videoChipsSnapshot
        .filter(isFoundVideoChip)
        .map((c) => ({ url: ytThumbnailUrl(c.videoId), title: c.title }));

      const entriesToSubmit = fileEntries;
      const foundChannels = [...channelWidgets.values()].filter(
        (w): w is { stage: "found"; ref: ChannelReference } =>
          w.stage === "found",
      );
      const channelRefs = foundChannels.map((w) => ({
        urls: w.ref.thumbnails.map((t) => t.url),
        handle: w.ref.handle,
      }));

      lastSubmittedPromptRef.current = sendPrompt;
      setPrompt("");
      setFileEntries([]);
      clearAll();
      entriesToSubmit.forEach((e) => URL.revokeObjectURL(e.url));
      startGenerating();

      const selectedVersion = versions.find((v) => v.id === selectedVersionId);

      try {
        let activeSessionId = versions.length > 0 ? sessionId : null;
        const sessionCreatedHere = !activeSessionId;
        if (!activeSessionId) {
          const sessionRes = await fetch("/api/sessions", { method: "POST" });
          if (!sessionRes.ok) throw new Error("Failed to create session");
          const sessionData = await sessionRes.json();
          if (!sessionData.id) throw new Error("Invalid session response");
          activeSessionId = sessionData.id as string;
          setSessionId(activeSessionId);
        }

        const uploadedImage =
          !selectedVersion && entriesToSubmit.length > 0
            ? {
                imageBase64: await resizeAndToBase64(entriesToSubmit[0].file),
                mimeType: "image/jpeg",
              }
            : undefined;

        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: sendPrompt,
            uploadedImage,
            channelRefs: channelRefs.length > 0 ? channelRefs : undefined,
            videoRefs: videoRefs.length > 0 ? videoRefs : undefined,
            sessionId: activeSessionId,
            previousGenerationId: selectedVersion?.generationId,
          }),
        });
        const data = await res.json();
        if (res.status === 402) {
          if (sessionCreatedHere) {
            fetch(`/api/sessions/${activeSessionId}`, {
              method: "DELETE",
            }).catch(() => {});
          }
          setLoading(false);
          openCreditsModal();
          return;
        }
        if (!res.ok) throw new Error(data.error ?? "Unknown error");

        decrementCredits();
        addVersion({
          generationId: data.generationId,
          imageUrl: `/api/images/${data.generationId}`,
          mimeType: data.mimeType,
          enhancedPrompt: data.enhancedPrompt ?? null,
          prompt: sendPrompt,
          rawPrompt: videoChipsSnapshot
            .filter(isFoundVideoChip)
            .reduce(
              (acc, c) => acc.replaceAll(c.title, c.originalUrl),
              trimmed,
            ),
          createdAt: Date.now(),
        });
      } catch (err) {
        toast(err instanceof Error ? err.message : "Something went wrong");
        setPrompt(sendPrompt);
        setLoading(false);
      } finally {
        requestAnimationFrame(() => textareaRef.current?.focus());
      }
    },
    [
      fileEntries,
      channelWidgets,
      videoChips,
      loading,
      versions,
      selectedVersionId,
      sessionId,
      startGenerating,
      addVersion,
      setSessionId,
      setLoading,
      decrementCredits,
      clearAll,
    ],
  );

  const effectivePrompt = prompt.replace(/@[\w.-]*/g, "").trim();
  const cleanedEffectivePrompt = stripVideoChips(effectivePrompt, videoChips);
  const hasDuplicateChannel =
    textSegments?.some((s) => s.type === "duplicate-channel") ?? false;
  const hasContent =
    !!cleanedEffectivePrompt &&
    !hasDuplicateChannel &&
    ![...channelWidgets.values()].some(
      (w) =>
        w.stage === "error" || w.stage === "loading" || w.stage === "empty",
    );

  const handleSubmit = useCallback(async () => {
    if (!hasContent || loading) return;
    if (!session) {
      if (effectivePrompt) setPendingPrompt(effectivePrompt);
      openAuthModal();
      return;
    }
    doSubmit(prompt);
  }, [
    hasContent,
    prompt,
    effectivePrompt,
    loading,
    session,
    setPendingPrompt,
    doSubmit,
  ]);

  useEffect(() => {
    if (sessionPending || !session || !pendingPrompt) return;
    setPendingPrompt(null);
    setPrompt(pendingPrompt);
    doSubmit(pendingPrompt);
  }, [sessionPending, session, pendingPrompt, setPendingPrompt, doSubmit]);

  const selectedVersion = useMemo(
    () => versions.find((v) => v.id === selectedVersionId),
    [versions, selectedVersionId],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (!textareaRef.current) return;

      if (e.key === "Tab" && !prompt) {
        const fill =
          selectedVersionId !== null
            ? (selectedVersion?.rawPrompt ?? selectedVersion?.prompt)
            : textareaRef.current?.placeholder;
        if (fill) {
          e.preventDefault();
          handleValueChange(fill);
          return;
        }
      }

      if (e.key !== "Backspace" && e.key !== "Delete") {
        if (pendingDeleteFile) setPendingDeleteFile(false);
        if (pendingDeleteVideoId) setPendingDeleteVideoId(null);
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      }

      if (
        e.key === "Backspace" &&
        fileEntries.length > 0 &&
        textareaRef.current.selectionStart === 0 &&
        textareaRef.current.selectionEnd === 0 &&
        !prompt
      ) {
        e.preventDefault();
        if (pendingDeleteFile) {
          removeFile(0);
          setPendingDeleteFile(false);
        } else {
          setPendingDeleteFile(true);
        }
        return;
      }

      if (!textSegments) return;
      const { selectionStart, selectionEnd } = textareaRef.current;

      let offset = 0;
      for (const seg of textSegments) {
        const start = offset;
        const end = offset + seg.text.length;
        if (seg.type === "youtube-url") {
          if (
            !e.shiftKey &&
            !e.metaKey &&
            !e.ctrlKey &&
            !e.altKey &&
            selectionStart === selectionEnd
          ) {
            const jumpTo =
              e.key === "ArrowLeft" && selectionStart === end
                ? start
                : e.key === "ArrowRight" && selectionStart === start
                  ? end
                  : null;
            if (jumpTo !== null) {
              e.preventDefault();
              requestAnimationFrame(() => {
                if (textareaRef.current) {
                  textareaRef.current.selectionStart = jumpTo;
                  textareaRef.current.selectionEnd = jumpTo;
                }
              });
              return;
            }
          }
          const hitBackspace =
            e.key === "Backspace" &&
            selectionStart === selectionEnd &&
            selectionStart === end;
          const hitDelete =
            e.key === "Delete" &&
            selectionStart === selectionEnd &&
            selectionStart === start;
          const hitInside =
            selectionStart === selectionEnd &&
            selectionStart > start &&
            selectionStart < end;
          const hitSelected = selectionStart === start && selectionEnd === end;
          if (hitBackspace || hitDelete || hitInside || hitSelected) {
            e.preventDefault();
            if (pendingDeleteVideoId === seg.videoId) {
              const newValue = prompt.slice(0, start) + prompt.slice(end);
              handleValueChange(newValue);
              requestAnimationFrame(() => {
                if (textareaRef.current) {
                  textareaRef.current.selectionStart = start;
                  textareaRef.current.selectionEnd = start;
                }
              });
              setPendingDeleteVideoId(null);
            } else {
              setPendingDeleteVideoId(seg.videoId);
            }
            return;
          }
        }
        offset = end;
      }
    },
    [
      textSegments,
      fileEntries,
      prompt,
      selectedVersionId,
      selectedVersion,
      pendingDeleteFile,
      pendingDeleteVideoId,
      removeFile,
      handleValueChange,
    ],
  );

  function handlePaste(e: React.ClipboardEvent) {
    const imageFiles = Array.from(e.clipboardData.items)
      .filter((item) => item.type.startsWith("image/"))
      .map((item) => item.getAsFile())
      .filter((f): f is File => f !== null);

    if (imageFiles.length > 0) addFiles(imageFiles);

    const pastedText = e.clipboardData.getData("text");
    if (!pastedText || !textareaRef.current) return;

    const { selectionStart, selectionEnd } = textareaRef.current;
    const newValue =
      prompt.slice(0, selectionStart) + pastedText + prompt.slice(selectionEnd);

    if (newValue.length > MAX_PROMPT_LENGTH) {
      e.preventDefault();
      handleValueChange(newValue.slice(0, MAX_PROMPT_LENGTH));
    }
  }

  const placeholder =
    loading && lastSubmittedPromptRef.current
      ? lastSubmittedPromptRef.current
      : selectedVersionId !== null
        ? (selectedVersion?.prompt ??
          `Describe changes from v${selectedVersionId}…`)
        : randomPlaceholder;

  return (
    <div className="absolute bottom-0 sm:bottom-5 sm:px-5 w-full flex justify-center pointer-events-none">
      <div className="mx-auto w-full max-w-xl pointer-events-auto">
        <FileUpload
          onFilesAdded={addFiles}
          accept="image/*"
          multiple={false}
          disabled={loading || selectedVersionId !== null}
        >
          <PromptInput
            value={prompt}
            onValueChange={handleValueChange}
            onSubmit={handleSubmit}
            onPaste={handlePaste}
            isLoading={loading}
            disabled={loading}
            onClick={() => {
              if (pendingDeleteFile) setPendingDeleteFile(false);
              if (pendingDeleteVideoId) setPendingDeleteVideoId(null);
            }}
          >
            <FileChipList
              fileEntries={fileEntries}
              pendingDeleteFile={pendingDeleteFile}
              fileHoverOpen={fileHoverOpen}
              onHoverOpenChange={setFileHoverOpen}
              onRemove={removeFile}
            />
            <div className="relative">
              <PromptTextOverlay
                textSegments={textSegments}
                videoChips={videoChips}
                channelWidgets={channelWidgets}
                overlayRef={overlayRef}
                shouldReduceMotion={shouldReduceMotion}
                prompt={prompt}
                pendingDeleteVideoId={pendingDeleteVideoId}
              />
              <PromptInputTextarea
                ref={textareaRef}
                placeholder={placeholder}
                suppressHydrationWarning
                autoFocus
                maxLength={MAX_PROMPT_LENGTH}
                className="caret-foreground text-transparent"
                onKeyDown={handleKeyDown}
                onScroll={() => {
                  if (overlayRef.current && textareaRef.current) {
                    overlayRef.current.scrollTop =
                      textareaRef.current.scrollTop;
                  }
                }}
              />
            </div>
            <PromptInputActions className="px-1 pb-1 pt-5 justify-end">
              {mounted && session ? (
                <AnimatePresence initial={false}>
                  {versions.length === 0 ? (
                    <motion.div
                      key="starting-image-btn"
                      initial={
                        shouldReduceMotion
                          ? { opacity: 0 }
                          : { opacity: 0, scale: 0.9 }
                      }
                      animate={
                        shouldReduceMotion
                          ? { opacity: 1 }
                          : { opacity: 1, scale: 1 }
                      }
                      exit={
                        shouldReduceMotion
                          ? { opacity: 0 }
                          : { opacity: 0, scale: 0.9 }
                      }
                      transition={{ duration: 0.2, ease: [0.25, 1, 0.5, 1] }}
                    >
                      <FileUploadTrigger
                        className={buttonVariants({
                          variant: "secondary",
                          size: "lg",
                        })}
                        disabled={loading || selectedVersionId !== null}
                      >
                        <Paperclip className="size-4" />
                        {fileEntries.length > 0
                          ? "Edit starting image"
                          : "Add starting image"}
                      </FileUploadTrigger>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              ) : (
                <button
                  type="button"
                  className={buttonVariants({
                    variant: "secondary",
                    size: "lg",
                  })}
                  onClick={() => {
                    pendingActionRef.current = "attach";
                    openAuthModal();
                  }}
                >
                  <Paperclip className="size-4" />
                  {fileEntries.length > 0
                    ? "Edit starting image"
                    : "Add starting image"}
                </button>
              )}
              <PromptInputAction tooltip="Send">
                <Button
                  onClick={handleSubmit}
                  disabled={loading || !hasContent}
                  size="icon-lg"
                >
                  <ArrowUp size={18} />
                </Button>
              </PromptInputAction>
            </PromptInputActions>
          </PromptInput>
          <FileUploadContent>
            <div className="bg-background/90 m-4 w-full max-w-md rounded-2xl border p-8 shadow-lg text-center">
              <Paperclip className="text-muted-foreground mx-auto mb-3 size-8" />
              <p className="font-medium">Drop starting image here</p>
              <p className="text-muted-foreground mt-1 text-sm">
                It will be used as the base for generation
              </p>
            </div>
          </FileUploadContent>
        </FileUpload>
      </div>
    </div>
  );
}
