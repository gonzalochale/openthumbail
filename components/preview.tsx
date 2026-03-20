"use client";

import { Download } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useThumbnailStore } from "@/store/use-thumbnail-store";
import { useShallow } from "zustand/react/shallow";

export function Preview() {
  const { versions, selectedVersionId, loading, download } = useThumbnailStore(
    useShallow((s) => ({
      versions: s.versions,
      selectedVersionId: s.selectedVersionId,
      loading: s.loading,
      download: s.download,
    })),
  );

  const selectedVersion = versions.find((v) => v.id === selectedVersionId);
  const isFirstLoad = versions.length === 0 && loading;

  return (
    <div className="w-full flex-1 flex flex-col items-center justify-center gap-2">
      <div className="w-full max-w-4xl">
        <div className="relative w-full" style={{ aspectRatio: "16/9" }}>
          {isFirstLoad && <Skeleton className="absolute inset-0 rounded-lg" />}
          {selectedVersion && (
            <img
              src={`data:${selectedVersion.mimeType};base64,${selectedVersion.imageBase64}`}
              alt={`Thumbnail v${selectedVersion.id}`}
              className="w-full h-full object-cover rounded-lg"
            />
          )}
        </div>
        {selectedVersion && (
          <div className="flex items-center justify-between mt-2">
            <p className="text-xs text-muted-foreground">
              v{selectedVersion.id}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => download(selectedVersion.id)}
              className="gap-1.5"
            >
              <Download size={14} />
              Download
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
