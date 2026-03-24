"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowUp, Paperclip, X } from "lucide-react";
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
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { authClient } from "@/lib/auth-client";
import { AuthModal } from "@/components/auth-modal";
import { CreditsModal } from "@/components/credits-modal";
import { cn, resizeAndToBase64 } from "@/lib/utils";
import { MAX_PROMPT_LENGTH } from "@/lib/constants";
import {
  type ChannelReference,
  stripVideoChips,
  youtubeRe,
  ytThumbnailUrl,
} from "@/lib/youtube";
import { getTextSegments } from "@/lib/text-segments";
import { useThumbnailShortcuts } from "@/hooks/use-thumbnail-shortcuts";
import { useYouTubeReferences } from "@/hooks/use-youtube-references";
import { PromptTextOverlay } from "@/components/prompt-text-overlay";

type FileEntry = { file: File; url: string };

export function GeneratePrompt() {
  useThumbnailShortcuts();
  const shouldReduceMotion = useReducedMotion();
  const [prompt, setPrompt] = useState("");
  const [fileEntries, setFileEntries] = useState<FileEntry[]>([]);
  const [pendingDeleteFile, setPendingDeleteFile] = useState(false);
  const [pendingDeleteVideoId, setPendingDeleteVideoId] = useState<
    string | null
  >(null);
  const [fileHoverOpen, setFileHoverOpen] = useState<boolean | undefined>(
    false,
  );
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [creditsModalOpen, setCreditsModalOpen] = useState(false);

  const pendingActionRef = useRef<"submit" | "attach" | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const { data: session, isPending: sessionPending } = authClient.useSession();
  const {
    versions,
    selectedVersionId,
    loading,
    setLoading,
    startGenerating,
    addVersion,
    pendingPrompt,
    setPendingPrompt,
    decrementCredits,
  } = useThumbnailStore(
    useShallow((s) => ({
      versions: s.versions,
      selectedVersionId: s.selectedVersionId,
      loading: s.loading,
      setLoading: s.setLoading,
      startGenerating: s.startGenerating,
      addVersion: s.addVersion,
      pendingPrompt: s.pendingPrompt,
      setPendingPrompt: s.setPendingPrompt,
      decrementCredits: s.decrementCredits,
    })),
  );

  const { channelWidgets, videoChips, processValueChange, clearAll } =
    useYouTubeReferences({
      onVideoTitleResolved: (originalUrl, title) => {
        setPrompt((prev) => prev.replace(originalUrl, title));
      },
      isAuthenticated: !!session,
      onAuthRequired: () => setAuthModalOpen(true),
    });

  function addFiles(newFiles: File[]) {
    if (!session) {
      pendingActionRef.current = "attach";
      setAuthModalOpen(true);
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
        .filter((c): c is typeof c & { stage: "found" } => c.stage === "found")
        .map((c) => ({
          url: ytThumbnailUrl(c.videoId),
        }));

      const entriesToSubmit = fileEntries;
      const foundChannels = [...channelWidgets.values()].filter(
        (w): w is { stage: "found"; ref: ChannelReference } =>
          w.stage === "found",
      );
      const channelRefs = foundChannels.map((w) => ({
        urls: w.ref.thumbnails.map((t) => t.url),
        handle: w.ref.handle,
      }));

      setPrompt("");
      setFileEntries([]);
      clearAll();
      entriesToSubmit.forEach((e) => URL.revokeObjectURL(e.url));
      startGenerating();

      const selectedVersion = versions.find((v) => v.id === selectedVersionId);

      try {
        let previousVersion:
          | {
              imageBase64: string;
              mimeType: string;
              enhancedPrompt: string | null;
            }
          | undefined;

        if (selectedVersion) {
          previousVersion = {
            imageBase64: selectedVersion.imageBase64,
            mimeType: selectedVersion.mimeType,
            enhancedPrompt: selectedVersion.enhancedPrompt,
          };
        } else if (entriesToSubmit.length > 0) {
          previousVersion = {
            imageBase64: await resizeAndToBase64(entriesToSubmit[0].file),
            mimeType: "image/jpeg",
            enhancedPrompt: null,
          };
        }

        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: sendPrompt,
            previousVersion,
            channelRefs: channelRefs.length > 0 ? channelRefs : undefined,
            videoRefs: videoRefs.length > 0 ? videoRefs : undefined,
          }),
        });
        const data = await res.json();
        if (res.status === 402) {
          setLoading(false);
          setCreditsModalOpen(true);
          return;
        }
        if (!res.ok) throw new Error(data.error ?? "Unknown error");

        decrementCredits();
        addVersion({
          imageBase64: data.image,
          mimeType: data.mimeType,
          enhancedPrompt: data.enhancedPrompt ?? null,
          prompt: sendPrompt,
          createdAt: Date.now(),
        });
      } catch (err) {
        toast(err instanceof Error ? err.message : "Something went wrong");
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
      startGenerating,
      addVersion,
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
      setAuthModalOpen(true);
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

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (!textareaRef.current) return;
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
            !e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey &&
            selectionStart === selectionEnd
          ) {
            const jumpTo =
              e.key === "ArrowLeft" && selectionStart === end ? start :
              e.key === "ArrowRight" && selectionStart === start ? end :
              null;
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
    selectedVersionId !== null
      ? `Describe changes from v${selectedVersionId}…`
      : "Create a thumbnail for my YouTube video with the title...";

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
            <AnimatePresence initial={false}>
              {fileEntries.length > 0 && (
                <motion.div
                  key="chips"
                  initial={
                    shouldReduceMotion
                      ? { opacity: 0 }
                      : { height: 0, opacity: 0 }
                  }
                  animate={
                    shouldReduceMotion
                      ? { opacity: 1 }
                      : { height: "auto", opacity: 1 }
                  }
                  exit={
                    shouldReduceMotion
                      ? { opacity: 0 }
                      : { height: 0, opacity: 0 }
                  }
                  transition={{ duration: 0.22, ease: [0.25, 1, 0.5, 1] }}
                  style={{ overflow: "hidden" }}
                >
                  <div className="flex flex-wrap gap-2 px-2 pt-2 pb-1">
                    <AnimatePresence mode="popLayout">
                      {fileEntries.map(({ file, url }, index) => (
                        <motion.div
                          key={url}
                          initial={
                            shouldReduceMotion
                              ? { opacity: 0 }
                              : { opacity: 0, scale: 0.85, filter: "blur(4px)" }
                          }
                          animate={
                            shouldReduceMotion
                              ? { opacity: 1 }
                              : { opacity: 1, scale: 1, filter: "blur(0px)" }
                          }
                          exit={
                            shouldReduceMotion
                              ? { opacity: 0 }
                              : { opacity: 0, scale: 0.85 }
                          }
                          transition={{
                            duration: 0.2,
                            ease: [0.25, 1, 0.5, 1],
                          }}
                          className={`bg-background border rounded-lg text-sm overflow-hidden transition-shadow duration-150 ${pendingDeleteFile ? "ring-2 ring-offset-1 ring-offset-card ring-destructive/60" : ""}`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <HoverCard
                            open={fileHoverOpen}
                            onOpenChange={setFileHoverOpen}
                          >
                            <HoverCardTrigger
                              delay={200}
                              closeDelay={100}
                              render={
                                <div className="flex items-center gap-1.5 pl-1.5 pr-2 py-1.5 cursor-default" />
                              }
                            >
                              <img
                                src={url}
                                alt="Starting image"
                                className="size-6 rounded-sm object-cover shrink-0"
                                draggable={false}
                              />
                              <span className="text-xs font-medium leading-tight text-muted-foreground">
                                Starting image
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeFile(index);
                                }}
                                className={buttonVariants({
                                  variant: "ghost",
                                  size: "icon-sm",
                                })}
                              >
                                <X className="size-3" />
                              </button>
                            </HoverCardTrigger>
                            <HoverCardContent
                              className="w-52 p-2"
                              side="top"
                              align="start"
                            >
                              <motion.img
                                src={url}
                                alt={file.name}
                                className="aspect-video w-full rounded-sm object-cover"
                                draggable={false}
                                initial={
                                  shouldReduceMotion
                                    ? false
                                    : { opacity: 0, scale: 0.95 }
                                }
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{
                                  duration: 0.18,
                                  ease: [0.25, 1, 0.5, 1],
                                }}
                              />
                            </HoverCardContent>
                          </HoverCard>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
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
              {session ? (
                <AnimatePresence initial={false}>
                  {versions.length === 0 && (
                    <motion.div
                      key="starting-image-btn"
                      initial={
                        shouldReduceMotion
                          ? { opacity: 0 }
                          : { opacity: 0, scale: 0.9, filter: "blur(4px)" }
                      }
                      animate={
                        shouldReduceMotion
                          ? { opacity: 1 }
                          : { opacity: 1, scale: 1, filter: "blur(0px)" }
                      }
                      exit={
                        shouldReduceMotion
                          ? { opacity: 0 }
                          : { opacity: 0, scale: 0.9, filter: "blur(4px)" }
                      }
                      transition={{ duration: 0.6, ease: [0.25, 1, 0.5, 1] }}
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
                  )}
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
                    setAuthModalOpen(true);
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
      <AuthModal open={authModalOpen} onOpenChange={setAuthModalOpen} />
      <CreditsModal
        open={creditsModalOpen}
        onOpenChange={setCreditsModalOpen}
      />
    </div>
  );
}
