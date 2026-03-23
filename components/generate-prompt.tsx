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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  FileUpload,
  FileUploadTrigger,
  FileUploadContent,
} from "@/components/file-upload";
import { authClient } from "@/lib/auth-client";
import { AuthModal } from "@/components/auth-modal";
import { CreditsModal } from "@/components/credits-modal";
import { resizeAndToBase64, formatFileSize } from "@/lib/utils";
import {
  DEBOUNCE_MS,
  MAX_FILES,
  MAX_PROMPT_LENGTH,
  VIDEO_TITLE_MAX_LENGTH,
} from "@/lib/constants";
import {
  type ChannelReference,
  type ChannelWidget,
  type VideoChip,
  countChannelThumbnails,
  extractYouTubeMatches,
  stripVideoChips,
  youtubeRe,
} from "@/lib/youtube";
import { Skeleton } from "@/components/ui/skeleton";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { useThumbnailShortcuts } from "@/hooks/use-thumbnail-shortcuts";
import { TextScramble } from "@/components/ui/text-scramble";

type FileEntry = { file: File; url: string };

type TextSegment =
  | { type: "plain"; text: string }
  | { type: "active"; text: string; handle: string }
  | { type: "duplicate-channel"; text: string }
  | { type: "youtube-url"; text: string; videoId: string };

function getTextSegments(
  text: string,
  channelWidgets: Map<string, ChannelWidget>,
  chips: VideoChip[],
): TextSegment[] {
  type RawMatch = { start: number; end: number; segment: TextSegment };
  const matches: RawMatch[] = [];

  const mentionRe = /@([\w.-]*)/g;
  const seenHandles = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = mentionRe.exec(text)) !== null) {
    const mentionText = m[0];
    const handle = m[1];
    if (!channelWidgets.has(handle)) continue;
    if (seenHandles.has(handle)) {
      matches.push({
        start: m.index,
        end: m.index + mentionText.length,
        segment: { type: "duplicate-channel", text: mentionText },
      });
      continue;
    }
    seenHandles.add(handle);
    matches.push({
      start: m.index,
      end: m.index + mentionText.length,
      segment: { type: "active", text: mentionText, handle },
    });
  }

  const ytRe = youtubeRe();
  while ((m = ytRe.exec(text)) !== null) {
    matches.push({
      start: m.index,
      end: m.index + m[0].length,
      segment: { type: "youtube-url", text: m[0], videoId: m[1] },
    });
  }

  for (const chip of chips) {
    if (chip.stage !== "found") continue;
    const idx = text.indexOf(chip.title);
    if (idx === -1) continue;
    matches.push({
      start: idx,
      end: idx + chip.title.length,
      segment: { type: "youtube-url", text: chip.title, videoId: chip.videoId },
    });
  }

  matches.sort((a, b) => a.start - b.start);

  const segments: TextSegment[] = [];
  let last = 0;
  for (const { start, end, segment } of matches) {
    if (start < last) continue;
    if (start > last)
      segments.push({ type: "plain", text: text.slice(last, start) });
    segments.push(segment);
    last = end;
  }
  if (last < text.length)
    segments.push({ type: "plain", text: text.slice(last) });
  return segments;
}

function MentionStatusChip({
  markClass,
  textClass,
  message,
  children,
}: {
  markClass: string;
  textClass: string;
  message: string;
  children: React.ReactNode;
}) {
  return (
    <HoverCard>
      <HoverCardTrigger
        delay={100}
        closeDelay={0}
        render={
          <mark
            className={`${markClass} rounded-sm not-italic cursor-default pointer-events-auto`}
          />
        }
      >
        {children}
      </HoverCardTrigger>
      <HoverCardContent className="w-auto p-2" side="top" align="start">
        <span className={`text-xs ${textClass}`}>{message}</span>
      </HoverCardContent>
    </HoverCard>
  );
}

export function GeneratePrompt() {
  useThumbnailShortcuts();
  const shouldReduceMotion = useReducedMotion();
  const [prompt, setPrompt] = useState("");
  const [fileEntries, setFileEntries] = useState<FileEntry[]>([]);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [creditsModalOpen, setCreditsModalOpen] = useState(false);
  const [channelWidgets, setChannelWidgets] = useState<
    Map<string, ChannelWidget>
  >(new Map());
  const [videoChips, setVideoChips] = useState<VideoChip[]>([]);

  const pendingActionRef = useRef<"submit" | "attach" | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const debounceTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );
  const inflightHandlesRef = useRef<Set<string>>(new Set());
  const videoInflightRef = useRef<Set<string>>(new Set());

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

  function addFiles(newFiles: File[]) {
    if (!session) {
      pendingActionRef.current = "attach";
      setAuthModalOpen(true);
      return;
    }
    const channelCount = countChannelThumbnails(channelWidgets);
    const videoCount = videoChips.filter((c) => c.stage !== "error").length;
    const remaining =
      MAX_FILES - fileEntries.length - videoCount - channelCount;
    if (remaining <= 0) {
      toast(`You've reached the ${MAX_FILES} reference image limit`);
      return;
    }
    if (newFiles.length > remaining) {
      toast(
        `Only ${remaining} reference slot${remaining === 1 ? "" : "s"} left (${MAX_FILES} max total)`,
      );
    }
    const toAdd = newFiles
      .slice(0, remaining)
      .map((file) => ({ file, url: URL.createObjectURL(file) }));
    setFileEntries((prev) => [...prev, ...toAdd]);
  }

  function removeFile(index: number) {
    setFileEntries((prev) => {
      URL.revokeObjectURL(prev[index].url);
      return prev.filter((_, i) => i !== index);
    });
  }

  async function fetchChannel(handle: string) {
    inflightHandlesRef.current.add(handle);
    try {
      const res = await fetch(
        `/api/youtube/channel?handle=${encodeURIComponent(handle)}`,
      );
      if (!inflightHandlesRef.current.has(handle)) return;
      const data = await res.json();
      if (!res.ok) {
        setChannelWidgets((prev) =>
          new Map(prev).set(handle, { stage: "error", handle }),
        );
        return;
      }
      const ref = data as ChannelReference;
      setChannelWidgets((prev) =>
        new Map(prev).set(
          handle,
          ref.thumbnails.length === 0
            ? { stage: "empty", handle }
            : { stage: "found", ref },
        ),
      );
    } catch {
      if (inflightHandlesRef.current.has(handle))
        setChannelWidgets((prev) =>
          new Map(prev).set(handle, { stage: "error", handle }),
        );
    } finally {
      inflightHandlesRef.current.delete(handle);
    }
  }

  async function addVideoChip(videoId: string, originalUrl: string) {
    if (videoInflightRef.current.has(videoId)) return;
    if (videoChips.some((c) => c.videoId === videoId)) return;
    const totalUsed =
      fileEntries.length +
      videoChips.length +
      videoInflightRef.current.size +
      countChannelThumbnails(channelWidgets);
    if (totalUsed >= MAX_FILES) {
      toast(`You've reached the ${MAX_FILES} reference image limit`);
      return;
    }
    videoInflightRef.current.add(videoId);
    setVideoChips((prev) => [
      ...prev,
      { stage: "loading", videoId, originalUrl },
    ]);
    try {
      const res = await fetch(
        `/api/youtube/video?videoId=${encodeURIComponent(videoId)}`,
      );
      if (!videoInflightRef.current.has(videoId)) return;
      const data = await res.json();
      if (!res.ok) {
        setVideoChips((prev) =>
          prev.map((c) =>
            c.videoId === videoId
              ? { stage: "error", videoId, originalUrl }
              : c,
          ),
        );
        return;
      }
      const rawTitle = data.title as string;
      const title =
        rawTitle.length > VIDEO_TITLE_MAX_LENGTH
          ? rawTitle.slice(0, VIDEO_TITLE_MAX_LENGTH - 1) + "…"
          : rawTitle;
      setVideoChips((prev) =>
        prev.map((c) =>
          c.videoId === videoId
            ? { stage: "found", videoId, title, originalUrl }
            : c,
        ),
      );
      setPrompt((prev) => prev.replace(originalUrl, title));
    } catch {
      if (videoInflightRef.current.has(videoId))
        setVideoChips((prev) =>
          prev.map((c) =>
            c.videoId === videoId
              ? { stage: "error", videoId, originalUrl }
              : c,
          ),
        );
    } finally {
      videoInflightRef.current.delete(videoId);
    }
  }

  function handleValueChange(value: string) {
    const urlMatches = extractYouTubeMatches(value);

    for (const m of urlMatches) {
      if (
        videoChips.some((c) => c.videoId === m.videoId) ||
        videoInflightRef.current.has(m.videoId)
      ) {
        value = value
          .replace(m.matchedUrl, "")
          .replace(/\s{2,}/g, " ")
          .trimStart();
      }
    }

    const titleChips = videoChips.filter(
      (c) => c.stage === "found" && value.includes(c.title),
    );
    const idsInTextSet = new Set([
      ...urlMatches.map((m) => m.videoId),
      ...titleChips.map((c) => c.videoId),
    ]);

    const toAdd = urlMatches.filter(
      (m) =>
        !videoChips.some((c) => c.videoId === m.videoId) &&
        !videoInflightRef.current.has(m.videoId),
    );

    if (videoChips.some((c) => !idsInTextSet.has(c.videoId))) {
      setVideoChips((prev) => prev.filter((c) => idsInTextSet.has(c.videoId)));
    }

    for (const id of [...videoInflightRef.current]) {
      if (!idsInTextSet.has(id)) videoInflightRef.current.delete(id);
    }

    toAdd.forEach((m) => addVideoChip(m.videoId, m.matchedUrl));

    setPrompt(value);
    if (pendingPrompt !== null) setPendingPrompt(value.trim() || null);

    const mentionedHandles = new Set<string>();
    const mentionRe = /@([\w.-]*)/g;
    let mm: RegExpExecArray | null;
    while ((mm = mentionRe.exec(value)) !== null) mentionedHandles.add(mm[1]);

    for (const [h, timer] of debounceTimersRef.current) {
      if (!mentionedHandles.has(h)) {
        clearTimeout(timer);
        debounceTimersRef.current.delete(h);
      }
    }
    for (const h of [...inflightHandlesRef.current]) {
      if (!mentionedHandles.has(h)) inflightHandlesRef.current.delete(h);
    }

    const toRemove = [...channelWidgets.keys()].filter(
      (h) => !mentionedHandles.has(h),
    );
    const toAddHandles = [...mentionedHandles].filter(
      (h) =>
        !channelWidgets.has(h) &&
        !inflightHandlesRef.current.has(h) &&
        !debounceTimersRef.current.has(h),
    );

    if (toRemove.length > 0 || toAddHandles.length > 0) {
      setChannelWidgets((prev) => {
        const next = new Map(prev);
        for (const h of toRemove) next.delete(h);
        for (const h of toAddHandles)
          next.set(h, { stage: "loading", handle: h });
        return next;
      });
    }

    for (const h of toAddHandles) {
      if (h === "") continue;
      const timer = setTimeout(() => {
        debounceTimersRef.current.delete(h);
        fetchChannel(h);
      }, DEBOUNCE_MS);
      debounceTimersRef.current.set(h, timer);
    }
  }

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

      const foundVideos = videoChipsSnapshot.filter(
        (c): c is VideoChip & { stage: "found" } => c.stage === "found",
      );
      const videoRefs = foundVideos.map((c) => ({
        url: `https://i.ytimg.com/vi/${c.videoId}/hqdefault.jpg`,
      }));

      const entriesToSubmit = fileEntries;
      const channelWidgetsSnapshot = channelWidgets;
      const foundChannels = [...channelWidgetsSnapshot.values()].filter(
        (w): w is { stage: "found"; ref: ChannelReference } =>
          w.stage === "found",
      );
      const channelRefs = foundChannels.map((w) => ({
        urls: w.ref.thumbnails.map((t) => t.url),
        handle: w.ref.handle,
      }));
      setPrompt("");
      setFileEntries([]);
      setChannelWidgets(new Map());
      setVideoChips([]);
      videoInflightRef.current.clear();
      inflightHandlesRef.current.clear();
      for (const timer of debounceTimersRef.current.values())
        clearTimeout(timer);
      debounceTimersRef.current.clear();
      entriesToSubmit.forEach((e) => URL.revokeObjectURL(e.url));
      startGenerating();

      const previousVersion = versions.find((v) => v.id === selectedVersionId);

      try {
        const referenceImages = await Promise.all(
          entriesToSubmit.map(async ({ file }) => ({
            imageBase64: await resizeAndToBase64(file),
            mimeType: "image/jpeg",
          })),
        );

        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: sendPrompt,
            previousVersion: previousVersion
              ? {
                  imageBase64: previousVersion.imageBase64,
                  mimeType: previousVersion.mimeType,
                  enhancedPrompt: previousVersion.enhancedPrompt,
                }
              : undefined,
            referenceImages:
              referenceImages.length > 0 ? referenceImages : undefined,
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

  useEffect(() => {
    return () => {
      for (const timer of debounceTimersRef.current.values())
        clearTimeout(timer);
      videoInflightRef.current.clear();
      inflightHandlesRef.current.clear();
    };
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if ((e.key !== "Backspace" && e.key !== "Delete") || !textareaRef.current)
        return;
      if (!textSegments) return;
      const { selectionStart, selectionEnd } = textareaRef.current;

      let offset = 0;
      for (const seg of textSegments) {
        const start = offset;
        const end = offset + seg.text.length;
        if (seg.type === "youtube-url") {
          if (selectionStart === start && selectionEnd === end) break;

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

          if (hitBackspace || hitDelete || hitInside) {
            e.preventDefault();
            textareaRef.current.selectionStart = start;
            textareaRef.current.selectionEnd = end;
            return;
          }
        }
        offset = end;
      }
    },
    [textSegments],
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
      <div className="mx-auto w-full max-w-2xl pointer-events-auto">
        <FileUpload onFilesAdded={addFiles} accept="image/*" disabled={loading}>
          <PromptInput
            value={prompt}
            onValueChange={handleValueChange}
            onSubmit={handleSubmit}
            onPaste={handlePaste}
            isLoading={loading}
            disabled={loading}
          >
            {fileEntries.length > 0 && (
              <div className="flex flex-wrap gap-2 px-1 pt-1">
                <AnimatePresence mode="popLayout">
                  {fileEntries.map(({ file, url }, index) => (
                    <motion.div
                      key={url}
                      layout
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
                      transition={{ type: "spring", bounce: 0, duration: 0.25 }}
                      className="bg-background border flex items-center gap-2 rounded-lg p-1.5 pr-2.5 text-sm"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <img
                        src={url}
                        alt={file.name}
                        className="size-9 rounded-sm object-cover shrink-0"
                      />
                      <div className="flex flex-col min-w-0">
                        <span className="max-w-10 truncate text-xs font-medium leading-tight">
                          {file.name}
                        </span>
                        <span className="text-muted-foreground text-xs leading-tight">
                          {formatFileSize(file.size)}
                        </span>
                      </div>
                      <button
                        onClick={() => removeFile(index)}
                        className={
                          buttonVariants({
                            variant: "destructive",
                            size: "icon-sm",
                          }) + " ml-auto"
                        }
                      >
                        <X className="size-3.5" />
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
            <div className="relative">
              <div
                ref={overlayRef}
                aria-hidden
                className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap wrap-break-word px-2 py-2 text-base leading-6 text-primary"
              >
                {textSegments
                  ? textSegments.map((p: TextSegment, i: number) => {
                      if (p.type === "plain")
                        return <span key={i}>{p.text}</span>;

                      if (p.type === "youtube-url") {
                        const chip = videoChips.find(
                          (c) => c.videoId === p.videoId,
                        );
                        if (chip?.stage === "error") {
                          return (
                            <MentionStatusChip
                              key={i}
                              markClass="bg-destructive/15 text-destructive"
                              textClass="text-destructive"
                              message="Video not found"
                            >
                              {p.text}
                            </MentionStatusChip>
                          );
                        }
                        const isFound = chip?.stage === "found";
                        return (
                          <HoverCard key={i}>
                            <HoverCardTrigger
                              delay={200}
                              closeDelay={100}
                              render={
                                <mark
                                  className={
                                    isFound
                                      ? "bg-channel text-channel-foreground rounded-sm not-italic cursor-default pointer-events-auto"
                                      : "bg-muted text-muted-foreground rounded-sm not-italic animate-pulse cursor-default pointer-events-auto"
                                  }
                                />
                              }
                            >
                              <TextScramble
                                as="span"
                                trigger={isFound && !shouldReduceMotion}
                              >
                                {p.text}
                              </TextScramble>
                            </HoverCardTrigger>
                            <HoverCardContent
                              className="w-52 p-2"
                              side="top"
                              align="start"
                            >
                              {isFound ? (
                                <>
                                  <motion.img
                                    src={`https://i.ytimg.com/vi/${chip.videoId}/hqdefault.jpg`}
                                    alt={chip.title}
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
                                </>
                              ) : (
                                <Skeleton className="aspect-video w-full rounded-sm" />
                              )}
                            </HoverCardContent>
                          </HoverCard>
                        );
                      }
                      if (p.type === "duplicate-channel") {
                        return (
                          <MentionStatusChip
                            key={i}
                            markClass="bg-destructive/15 text-destructive"
                            textClass="text-destructive"
                            message="Can't tag the same channel twice"
                          >
                            {p.text}
                          </MentionStatusChip>
                        );
                      }
                      const widget = channelWidgets.get(p.handle);
                      const widgetFound =
                        widget?.stage === "found" ? widget : null;
                      if (widgetFound) {
                        return (
                          <HoverCard key={i}>
                            <HoverCardTrigger
                              delay={200}
                              closeDelay={100}
                              render={
                                <mark className="bg-channel text-channel-foreground rounded-sm not-italic cursor-default pointer-events-auto" />
                              }
                            >
                              {p.text}
                            </HoverCardTrigger>
                            <HoverCardContent
                              className="w-52 p-2"
                              side="top"
                              align="start"
                            >
                              <div className="flex flex-col gap-1.5 select-none">
                                {widgetFound.ref.thumbnails
                                  .slice(0, 3)
                                  .map((thumb, j) => (
                                    <motion.img
                                      key={thumb.videoId}
                                      src={thumb.url}
                                      alt={thumb.title}
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
                                        delay: j * 0.04,
                                        ease: [0.25, 1, 0.5, 1],
                                      }}
                                    />
                                  ))}
                              </div>
                            </HoverCardContent>
                          </HoverCard>
                        );
                      }
                      if (widget?.stage === "error") {
                        return (
                          <MentionStatusChip
                            key={i}
                            markClass="bg-destructive/15 text-destructive"
                            textClass="text-destructive"
                            message="Channel not found"
                          >
                            {p.text}
                          </MentionStatusChip>
                        );
                      }
                      if (widget?.stage === "empty") {
                        return (
                          <MentionStatusChip
                            key={i}
                            markClass="bg-destructive/15 text-destructive"
                            textClass="text-destructive"
                            message="No videos found"
                          >
                            {p.text}
                          </MentionStatusChip>
                        );
                      }
                      return (
                        <HoverCard key={i}>
                          <HoverCardTrigger
                            delay={200}
                            closeDelay={100}
                            render={
                              <mark className="bg-muted text-muted-foreground rounded-sm not-italic animate-pulse cursor-default pointer-events-auto" />
                            }
                          >
                            {p.text}
                          </HoverCardTrigger>
                          <HoverCardContent
                            className="w-52 p-2"
                            side="top"
                            align="start"
                          >
                            <div className="flex flex-col gap-1.5">
                              {Array.from({ length: 3 }).map((_, idx) => (
                                <Skeleton
                                  key={idx}
                                  className="aspect-video w-full rounded-sm"
                                />
                              ))}
                            </div>
                          </HoverCardContent>
                        </HoverCard>
                      );
                    })
                  : prompt}
              </div>
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
            <PromptInputActions className="justify-between px-1 pb-1">
              <Tooltip>
                <TooltipTrigger
                  render={
                    session ? (
                      <FileUploadTrigger
                        className={buttonVariants({
                          variant: "ghost",
                          size: "icon-lg",
                        })}
                        disabled={loading}
                      >
                        <Paperclip className="size-4" />
                      </FileUploadTrigger>
                    ) : (
                      <button
                        type="button"
                        className={buttonVariants({
                          variant: "ghost",
                          size: "icon-lg",
                        })}
                        onClick={() => {
                          pendingActionRef.current = "attach";
                          setAuthModalOpen(true);
                        }}
                      >
                        <Paperclip className="size-4" />
                      </button>
                    )
                  }
                />
                <TooltipContent>Attach image</TooltipContent>
              </Tooltip>
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
              <p className="font-medium">Drop images here</p>
              <p className="text-muted-foreground mt-1 text-sm">
                Release to attach to your prompt
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
