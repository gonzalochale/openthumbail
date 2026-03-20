import { Skeleton } from "@/components/ui/skeleton";

interface PreviewProps {
  imageBase64: string | null;
  enhancedPrompt: string | null;
  loading: boolean;
}

export function Preview({
  imageBase64,
  enhancedPrompt,
  loading,
}: PreviewProps) {
  return (
    <div className="w-full flex-1 flex items-center justify-center">
      <div className="w-full max-w-3xl">
        <div className="relative w-full" style={{ aspectRatio: "16/9" }}>
          {loading && <Skeleton className="absolute inset-0 rounded-lg" />}

          {imageBase64 && !loading && (
            <img
              src={`data:image/png;base64,${imageBase64}`}
              alt="Generated thumbnail"
              className="w-full h-full object-cover rounded-lg"
            />
          )}

          {!imageBase64 && !loading && (
            <div className="absolute inset-0 rounded-lg border border-dashed flex items-center justify-center text-muted-foreground text-sm">
              Thumbnail preview will appear here
            </div>
          )}
        </div>

        {imageBase64 && (
          <p className="text-xs text-muted-foreground text-center mt-2">
            1920 × 1080 · PNG
          </p>
        )}

        {enhancedPrompt && (
          <details className="mt-4 text-xs text-muted-foreground">
            <summary className="cursor-pointer select-none font-medium text-foreground/70 hover:text-foreground transition-colors">
              Enhanced prompt
            </summary>
            <p className="mt-2 leading-relaxed whitespace-pre-wrap">
              {enhancedPrompt}
            </p>
          </details>
        )}
      </div>
    </div>
  );
}
