"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
import { MAX_FILES, MAX_PROMPT_LENGTH } from "@/lib/constants";
import { Skeleton } from "@/components/ui/skeleton";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { useThumbnailShortcuts } from "@/hooks/use-thumbnail-shortcuts";

type FileEntry = { file: File; url: string };

export type ChannelThumbnail = {
  videoId: string;
  url: string;
  title: string;
};

export type ChannelReference = {
  handle: string;
  thumbnails: ChannelThumbnail[];
};

type ChannelWidget =
  | { stage: "loading"; handle: string }
  | { stage: "found"; ref: ChannelReference }
  | { stage: "empty"; handle: string }
  | { stage: "error"; handle: string }
  | null;

const MENTION_RE = /@([\w.-]*)/;
const DEBOUNCE_MS = 600;

type TextSegment =
  | { type: "plain"; text: string }
  | { type: "active"; text: string }
  | { type: "extra"; text: string };

function getTextSegments(
  text: string,
  activeHandle: string | null,
): TextSegment[] {
  const re = /@([\w.-]*)/g;
  const segments: TextSegment[] = [];
  let last = 0;
  let activeConsumed = false;
  let m: RegExpExecArray | null;

  while ((m = re.exec(text)) !== null) {
    if (m.index > last)
      segments.push({ type: "plain", text: text.slice(last, m.index) });

    const mentionText = m[0];
    const handle = m[1];
    const isActive =
      !activeConsumed &&
      activeHandle !== null &&
      (activeHandle === "" || handle === activeHandle);

    if (isActive) {
      segments.push({ type: "active", text: mentionText });
      activeConsumed = true;
    } else {
      segments.push({ type: "extra", text: mentionText });
    }
    last = m.index + mentionText.length;
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
  const [prompt, setPrompt] = useState("");
  const [fileEntries, setFileEntries] = useState<FileEntry[]>([]);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [creditsModalOpen, setCreditsModalOpen] = useState(false);
  const [channelWidget, setChannelWidget] = useState<ChannelWidget>(null);

  const pendingActionRef = useRef<"submit" | "attach" | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inflightRef = useRef<string | null>(null); // handle currently being fetched
  const pendingHandleRef = useRef<string | null>(null); // handle waiting for debounce

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
    const remaining = MAX_FILES - fileEntries.length;
    if (remaining <= 0) {
      toast("You can only attach up to 5 images");
      return;
    }
    if (newFiles.length > remaining) {
      toast(`You can only attach up to ${MAX_FILES} images`);
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
    inflightRef.current = handle;
    try {
      const res = await fetch(
        `/api/youtube/channel?handle=${encodeURIComponent(handle)}`,
      );
      if (inflightRef.current !== handle) return;
      const data = await res.json();
      if (!res.ok) {
        setChannelWidget({ stage: "error", handle });
        return;
      }
      const ref = data as ChannelReference;
      if (ref.thumbnails.length === 0) {
        setChannelWidget({ stage: "empty", handle });
      } else {
        setChannelWidget({ stage: "found", ref });
      }
    } catch {
      if (inflightRef.current === handle)
        setChannelWidget({ stage: "error", handle });
    } finally {
      if (inflightRef.current === handle) inflightRef.current = null;
    }
  }

  function handleValueChange(value: string) {
    setPrompt(value);
    if (pendingPrompt !== null) setPendingPrompt(value.trim() || null);

    const match = value.match(MENTION_RE);
    const handle = match ? match[1] : null;

    if (handle === null) {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      inflightRef.current = null;
      pendingHandleRef.current = null;
      setChannelWidget(null);
      return;
    }

    if (handle === "") {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      pendingHandleRef.current = null;
      if (channelWidget?.stage !== "loading" || channelWidget.handle !== "") {
        setChannelWidget({ stage: "loading", handle: "" });
      }
      return;
    }

    if (handle === pendingHandleRef.current) return;

    const resolvedHandle =
      channelWidget?.stage === "found"
        ? channelWidget.ref.handle
        : channelWidget?.stage === "error" || channelWidget?.stage === "empty"
          ? channelWidget.handle
          : null;
    if (handle === resolvedHandle) return;

    pendingHandleRef.current = handle;
    inflightRef.current = null;
    setChannelWidget({ stage: "loading", handle });
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      pendingHandleRef.current = null;
      fetchChannel(handle);
    }, DEBOUNCE_MS);
  }

  const channelRef =
    channelWidget?.stage === "found" ? channelWidget.ref : null;

  const activeHandle =
    channelWidget === null
      ? null
      : channelWidget.stage === "found"
        ? channelWidget.ref.handle
        : channelWidget.handle;

  const isError = channelWidget?.stage === "error";
  const isEmpty = channelWidget?.stage === "empty";
  const textSegments = /@/.test(prompt)
    ? getTextSegments(prompt, activeHandle)
    : null;

  const doSubmit = useCallback(
    async (promptValue: string) => {
      if (!promptValue.trim() || loading) return;
      const trimmed = promptValue.trim();
      const entriesToSubmit = fileEntries;
      const channelRefSnapshot = channelRef;
      setPrompt("");
      setFileEntries([]);
      setChannelWidget(null);
      if (debounceRef.current) clearTimeout(debounceRef.current);
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
            prompt: trimmed,
            previousVersion: previousVersion
              ? {
                  imageBase64: previousVersion.imageBase64,
                  mimeType: previousVersion.mimeType,
                  enhancedPrompt: previousVersion.enhancedPrompt,
                }
              : undefined,
            referenceImages:
              referenceImages.length > 0 ? referenceImages : undefined,
            channelThumbnailUrls:
              channelRefSnapshot && channelRefSnapshot.thumbnails.length > 0
                ? channelRefSnapshot.thumbnails.map((t) => t.url)
                : undefined,
            channelHandle: channelRefSnapshot?.handle,
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
          prompt: trimmed,
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
      channelRef,
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
  const hasExtraMentions =
    textSegments?.some((s) => s.type === "extra") ?? false;
  const hasContent =
    !!effectivePrompt &&
    !hasExtraMentions &&
    channelWidget?.stage !== "error" &&
    channelWidget?.stage !== "loading" &&
    channelWidget?.stage !== "empty";

  const handleSubmit = useCallback(async () => {
    if (!hasContent || loading) return;
    if (!session) {
      if (effectivePrompt) setPendingPrompt(effectivePrompt);
      setAuthModalOpen(true);
      return;
    }
    doSubmit(effectivePrompt);
  }, [
    hasContent,
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
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

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
      prompt.slice(0, selectionStart) +
      pastedText +
      prompt.slice(selectionEnd);

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
                {fileEntries.map(({ file, url }, index) => (
                  <div
                    key={url}
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
                  </div>
                ))}
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

                      if (p.type === "extra") {
                        return (
                          <MentionStatusChip
                            key={i}
                            markClass="bg-destructive/15 text-destructive"
                            textClass="text-destructive"
                            message="Only one channel can be referenced per message"
                          >
                            {p.text}
                          </MentionStatusChip>
                        );
                      }
                      if (channelRef) {
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
                              className="w-72 p-2"
                              side="top"
                              align="start"
                            >
                              <div className="grid grid-cols-3 gap-1.5 select-none">
                                {channelRef.thumbnails
                                  .slice(0, 3)
                                  .map((thumb) => (
                                    <img
                                      key={thumb.videoId}
                                      src={thumb.url}
                                      alt={thumb.title}
                                      className="aspect-video w-full rounded-sm object-cover"
                                      draggable={false}
                                    />
                                  ))}
                              </div>
                            </HoverCardContent>
                          </HoverCard>
                        );
                      }
                      if (isError) {
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
                      if (isEmpty) {
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
                            className="w-72 p-2"
                            side="top"
                            align="start"
                          >
                            <div className="grid grid-cols-3 gap-1.5">
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
