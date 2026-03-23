"use client";

import { motion } from "motion/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { type ChannelWidget, type VideoChip } from "@/lib/youtube";
import { type TextSegment } from "@/lib/text-segments";
import { MentionStatusChip } from "@/components/mention-status-chip";
import { Skeleton } from "@/components/ui/skeleton";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { TextScramble } from "@/components/ui/text-scramble";

function hoverKey(seg: TextSegment): string | null {
  if (seg.type === "active") return `channel:${seg.handle}`;
  if (seg.type === "youtube-url") return `video:${seg.videoId}`;
  return null;
}

export function PromptTextOverlay({
  textSegments,
  videoChips,
  channelWidgets,
  overlayRef,
  shouldReduceMotion,
  prompt,
  pendingDeleteVideoId,
}: {
  textSegments: TextSegment[] | null;
  videoChips: VideoChip[];
  channelWidgets: Map<string, ChannelWidget>;
  overlayRef: React.RefObject<HTMLDivElement | null>;
  shouldReduceMotion: boolean | null;
  prompt: string;
  pendingDeleteVideoId?: string | null;
}) {
  const [displayedSegments, setDisplayedSegments] = useState(textSegments);

  const [openKey, setOpenKey] = useState<string | null>(null);

  const openKeyRef = useRef<string | null>(null);
  const animatingRef = useRef(false);
  const pendingSegmentsRef = useRef(textSegments);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  useLayoutEffect(() => {
    pendingSegmentsRef.current = textSegments;
    if (animatingRef.current) return;

    const openK = openKeyRef.current;
    const stillExists =
      openK === null ||
      (textSegments?.some((s) => hoverKey(s) === openK) ?? false);
    if (stillExists) {
      setDisplayedSegments(textSegments);
      return;
    }

    animatingRef.current = true;
    openKeyRef.current = null;
    setOpenKey(null);
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => {
      animatingRef.current = false;
      setDisplayedSegments(pendingSegmentsRef.current);
    }, 130);
  }, [textSegments]);

  function handleSegmentOpenChange(key: string, open: boolean) {
    const next = open ? key : null;
    openKeyRef.current = next;
    setOpenKey(next);
  }

  return (
    <div
      ref={overlayRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap wrap-break-word px-2 py-2 text-base leading-6 text-primary"
    >
      {displayedSegments
        ? displayedSegments.map((p: TextSegment, i: number) => {
            if (p.type === "plain") return <span key={i}>{p.text}</span>;

            if (p.type === "youtube-url") {
              const chip = videoChips.find((c) => c.videoId === p.videoId);
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
              const key = `video:${p.videoId}`;
              return (
                <HoverCard
                  key={i}
                  open={openKey === key}
                  onOpenChange={(o) => handleSegmentOpenChange(key, o)}
                >
                  <HoverCardTrigger
                    delay={200}
                    closeDelay={100}
                    render={
                      <mark
                        className={
                          (isFound
                            ? "bg-channel text-channel-foreground rounded-sm not-italic cursor-default pointer-events-auto"
                            : "bg-muted text-muted-foreground rounded-sm not-italic animate-pulse cursor-default pointer-events-auto") +
                          (pendingDeleteVideoId === p.videoId
                            ? " ring-2 ring-offset-1 ring-offset-card ring-destructive/60"
                            : "")
                        }
                      />
                    }
                  >
                    <TextScramble
                      as="span"
                      trigger={isFound && !shouldReduceMotion}
                    >
                      {isFound && chip ? chip.title : p.text}
                    </TextScramble>
                  </HoverCardTrigger>
                  <HoverCardContent
                    className="w-52 p-2"
                    side="top"
                    align="start"
                  >
                    {isFound ? (
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
                        transition={{ duration: 0.18, ease: [0.25, 1, 0.5, 1] }}
                      />
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
            const widgetFound = widget?.stage === "found" ? widget : null;
            const key = `channel:${p.handle}`;

            if (widgetFound) {
              return (
                <HoverCard
                  key={i}
                  open={openKey === key}
                  onOpenChange={(o) => handleSegmentOpenChange(key, o)}
                >
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
              <HoverCard
                key={i}
                open={openKey === key}
                onOpenChange={(o) => handleSegmentOpenChange(key, o)}
              >
                <HoverCardTrigger
                  delay={200}
                  closeDelay={100}
                  render={
                    <mark className="bg-muted text-muted-foreground rounded-sm not-italic animate-pulse cursor-default pointer-events-auto" />
                  }
                >
                  {p.text}
                </HoverCardTrigger>
                <HoverCardContent className="w-52 p-2" side="top" align="start">
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
  );
}
