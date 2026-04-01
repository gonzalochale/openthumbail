"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AnimatePresence, m, useReducedMotion } from "motion/react";
import { ArrowUp, Paperclip } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { useThumbnailStore } from "@/store/use-thumbnail-store";
import { useThumbnailUIStore } from "@/store/use-thumbnail-ui-store";
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
import { authClient } from "@/lib/auth/client";
import { randomItem, resizeAndToBase64 } from "@/lib/utils";
import { MAX_PROMPT_LENGTH, PROMPT_PLACEHOLDERS } from "@/lib/constants";
import {
  type ChannelReference,
  isFoundVideoChip,
  stripVideoChips,
  youtubeRe,
  ytThumbnailUrl,
} from "@/lib/youtube/utils";
import { getTextSegments } from "@/lib/youtube/text-segments";
import { useThumbnailShortcuts } from "@/hooks/use-thumbnail-shortcuts";
import { useYouTubeReferences } from "@/hooks/use-youtube-references";
import { useCameoReferences } from "@/hooks/use-cameo-references";
import { PromptTextOverlay } from "@/components/youtube/prompt-text-overlay";
import { FileChipList, type FileEntry } from "@/components/file-chip-list";
import { CameoButton } from "@/components/cameo/cameo-button";
import { useUserGeminiKeyStore } from "@/store/use-user-gemini-key-store";
import { useCameoStore } from "@/store/use-cameo-store";

export function GeneratePrompt() {
  useThumbnailShortcuts();
  const router = useRouter();
  const params = useParams<{ sessionId?: string }>();
  const shouldReduceMotion = useReducedMotion();
  const [prompt, setPrompt] = useState("");
  const lastSubmittedPromptRef = useRef<string | null>(null);
  const [randomPlaceholder] = useState(() => randomItem(PROMPT_PLACEHOLDERS));
  const [fileEntries, setFileEntries] = useState<FileEntry[]>([]);
  const [pendingDeleteFile, setPendingDeleteFile] = useState(false);
  const [pendingDeleteVideoId, setPendingDeleteVideoId] = useState<
    string | null
  >(null);
  const [pendingDeleteCameo, setPendingDeleteCameo] = useState<string | null>(
    null,
  );
  const [fileHoverOpen, setFileHoverOpen] = useState<boolean | undefined>(
    false,
  );
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const prevRouteSessionIdRef = useRef<string | undefined>(params.sessionId);

  const { data: session } = authClient.useSession();
  const userGeminiApiKey = useUserGeminiKeyStore((s) => s.apiKey);
  const {
    versions,
    selectedVersionId,
    sessionId,
    loading,
    setLoading,
    startGenerating,
    addVersion,
    setSessionId,
    selectVersion,
    decrementCredits,
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
      selectVersion: s.selectVersion,
      decrementCredits: s.decrementCredits,
      clearTick: s.clearTick,
    })),
  );
  const openAuthModal = useThumbnailUIStore((s) => s.openAuthModal);
  const openCreditsModal = useThumbnailUIStore((s) => s.openCreditsModal);
  const promptFocusTick = useThumbnailUIStore((s) => s.promptFocusTick);

  const isSessionLoading = !!params.sessionId && params.sessionId !== sessionId;

  useEffect(() => {
    if (promptFocusTick === 0) return;
    requestAnimationFrame(() => textareaRef.current?.focus());
  }, [promptFocusTick]);

  useEffect(() => {
    const prev = prevRouteSessionIdRef.current;
    const current = params.sessionId;
    if (prev && !current) {
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
    prevRouteSessionIdRef.current = current;
  }, [params.sessionId]);

  const { cameoActive } = useCameoReferences(prompt);
  const cameoRegistered = useCameoStore((s) => s.registered);
  const cameoLoading = useCameoStore((s) => s.loading);

  const reservedSlots =
    (selectedVersionId !== null ? 1 : 0) +
    (cameoActive && cameoRegistered ? 1 : 0);

  const { channelWidgets, videoChips, processValueChange, clearAll } =
    useYouTubeReferences({
      onVideoTitleResolved: (originalUrl, title) => {
        setPrompt((prev) => prev.replace(originalUrl, title));
      },
      isAuthenticated: !!session,
      onAuthRequired: () => openAuthModal(),
      reservedSlots,
    });
  const isStartingImageDisabled =
    loading || cameoLoading || selectedVersionId !== null;

  useEffect(() => {
    if (clearTick === 0) return;
    setPrompt("");
    setFileEntries([]);
    clearAll();
  }, [clearTick, clearAll]);

  function addFiles(newFiles: File[]) {
    if (!session) {
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
      if (!session) {
        const hasYouTubeRef = youtubeRe().test(value);
        if (hasYouTubeRef) {
          openAuthModal();
          return;
        }
      }

      const processed = processValueChange(value);
      setPrompt(processed);
      if (pendingDeleteFile) setPendingDeleteFile(false);
      if (pendingDeleteVideoId) setPendingDeleteVideoId(null);
      if (pendingDeleteCameo) setPendingDeleteCameo(null);
    },
    [
      session,
      processValueChange,
      pendingDeleteFile,
      pendingDeleteVideoId,
      openAuthModal,
    ],
  );

  const textSegments = useMemo(
    () =>
      /@/.test(prompt) ||
      /youtu/.test(prompt) ||
      /#(me|cameo)\b/i.test(prompt) ||
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

      const selectedVersion = versions.find((v) => v.id === selectedVersionId);
      const isCameo =
        (cameoActive && cameoRegistered) || Boolean(selectedVersion?.cameoUsed);
      const generationPrompt = trimmed
        .replace(youtubeRe(), "")
        .replace(/\s{2,}/g, " ")
        .trim();

      const sendPrompt = videoChipsSnapshot
        .filter(isFoundVideoChip)
        .reduce((acc, c) => acc.replaceAll(c.title, c.originalUrl), trimmed);

      const videoRefs = videoChipsSnapshot
        .filter(isFoundVideoChip)
        .map((c) => ({ url: ytThumbnailUrl(c.videoId), title: c.title }));

      const entriesToSubmit = fileEntries;
      const foundChannels = [...channelWidgets.values()].filter(
        (w): w is { stage: "found"; ref: ChannelReference } =>
          w.stage === "found",
      );
      const lowerPrompt = trimmed.toLowerCase();
      const channelRefs = foundChannels
        .slice()
        .sort((a, b) => {
          const aIdx = lowerPrompt.indexOf(`@${a.ref.handle.toLowerCase()}`);
          const bIdx = lowerPrompt.indexOf(`@${b.ref.handle.toLowerCase()}`);
          if (aIdx === -1 && bIdx === -1) return 0;
          if (aIdx === -1) return 1;
          if (bIdx === -1) return -1;
          return aIdx - bIdx;
        })
        .map((w) => ({
          urls: w.ref.thumbnails.map((t) => t.url),
          handle: w.ref.handle,
        }));

      lastSubmittedPromptRef.current = sendPrompt;
      setPrompt("");
      setFileEntries([]);
      clearAll();
      entriesToSubmit.forEach((e) => URL.revokeObjectURL(e.url));
      startGenerating();

      let activeSessionId = versions.length > 0 ? sessionId : null;
      const sessionCreatedHere = !activeSessionId;
      let generationSaved = false;

      try {
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
            generationPrompt,
            userApiKey: userGeminiApiKey || undefined,
            uploadedImage,
            channelRefs: channelRefs.length > 0 ? channelRefs : undefined,
            videoRefs: videoRefs.length > 0 ? videoRefs : undefined,
            sessionId: activeSessionId,
            previousGenerationId: selectedVersion?.generationId,
            isCameo: isCameo || undefined,
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

        if (useThumbnailStore.getState().sessionId !== activeSessionId) {
          setLoading(false);
          return;
        }

        decrementCredits();
        addVersion({
          generationId: data.generationId,
          imageUrl: `/api/images/${data.generationId}`,
          mimeType: data.mimeType,
          enhancedPrompt: data.enhancedPrompt ?? null,
          prompt: sendPrompt,
          cameoUsed: data.cameoUsed ?? isCameo,
          createdAt: Date.now(),
        });
        generationSaved = true;

        if (sessionCreatedHere) {
          router.push(`/${activeSessionId}`);
        }
      } catch (err) {
        if (sessionCreatedHere && activeSessionId && !generationSaved) {
          void fetch(`/api/sessions/${activeSessionId}`, {
            method: "DELETE",
          }).catch(() => {});
        }
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
      userGeminiApiKey,
      cameoActive,
      cameoRegistered,
    ],
  );

  const effectivePrompt = prompt.replace(/@[\w.-]*/g, "").trim();
  const cleanedEffectivePrompt = stripVideoChips(effectivePrompt, videoChips);
  const hasDuplicateChannel =
    textSegments?.some((s) => s.type === "duplicate-channel") ?? false;
  const hasUnregisteredCameo = cameoActive && !cameoRegistered;
  const hasContent =
    !!cleanedEffectivePrompt &&
    !hasDuplicateChannel &&
    !hasUnregisteredCameo &&
    ![...channelWidgets.values()].some(
      (w) =>
        w.stage === "error" || w.stage === "loading" || w.stage === "empty",
    );

  const handleSubmit = useCallback(async () => {
    if (!hasContent || loading) return;
    if (!session) {
      openAuthModal();
      return;
    }
    doSubmit(prompt);
  }, [hasContent, prompt, loading, session, doSubmit]);

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
            ? selectedVersion?.prompt
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
        (e.key === "ArrowLeft" || e.key === "ArrowRight") &&
        !prompt &&
        versions.length > 1
      ) {
        const currentIndex = versions.findIndex(
          (v) => v.id === selectedVersionId,
        );
        if (currentIndex !== -1) {
          const nextIndex =
            e.key === "ArrowLeft"
              ? Math.max(0, currentIndex - 1)
              : Math.min(versions.length - 1, currentIndex + 1);
          if (nextIndex !== currentIndex) {
            e.preventDefault();
            selectVersion(versions[nextIndex].id);
          }
          return;
        }
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
        if (seg.type === "cameo") {
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
            if (pendingDeleteCameo === seg.text) {
              const newValue = prompt.slice(0, start) + prompt.slice(end);
              handleValueChange(newValue);
              requestAnimationFrame(() => {
                if (textareaRef.current) {
                  textareaRef.current.selectionStart = start;
                  textareaRef.current.selectionEnd = start;
                }
              });
              setPendingDeleteCameo(null);
            } else {
              setPendingDeleteCameo(seg.text);
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
      versions,
      selectedVersionId,
      selectedVersion,
      pendingDeleteFile,
      pendingDeleteVideoId,
      pendingDeleteCameo,
      removeFile,
      handleValueChange,
      selectVersion,
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

    if (!session && youtubeRe().test(pastedText)) {
      e.preventDefault();
      openAuthModal();
      return;
    }

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
    <div
      inert={isSessionLoading || undefined}
      className="absolute bottom-0 sm:bottom-5 sm:px-5 w-full flex justify-center pointer-events-none"
    >
      <div className="mx-auto w-full max-w-xl pointer-events-auto">
        <FileUpload
          onFilesAdded={addFiles}
          accept="image/*"
          multiple={false}
          disabled={isStartingImageDisabled}
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
              if (pendingDeleteCameo) setPendingDeleteCameo(null);
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
                cameoRegistered={cameoRegistered}
                pendingDeleteCameo={pendingDeleteCameo}
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
            <PromptInputActions className="px-1 pb-1 pt-5 justify-end gap-1.5">
              {mounted && session ? (
                <AnimatePresence initial={false}>
                  {versions.length === 0 ? (
                    <m.div
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
                        disabled={isStartingImageDisabled}
                      >
                        <Paperclip className="size-4" />
                        Starting image
                      </FileUploadTrigger>
                    </m.div>
                  ) : null}
                </AnimatePresence>
              ) : (
                <button
                  type="button"
                  className={buttonVariants({
                    variant: "secondary",
                    size: "lg",
                  })}
                  disabled={loading || cameoLoading}
                  onClick={() => {
                    openAuthModal();
                  }}
                >
                  <Paperclip className="size-4" />
                  Starting image
                </button>
              )}
              <CameoButton />
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
