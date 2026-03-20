import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface ControlsProps {
  apiKey: string;
  prompt: string;
  loading: boolean;
  error: string | null;
  hasImage: boolean;
  onApiKeyChange: (value: string) => void;
  onPromptChange: (value: string) => void;
  onGenerate: () => void;
  onDownload: () => void;
}

export function Controls({
  apiKey,
  prompt,
  loading,
  error,
  hasImage,
  onApiKeyChange,
  onPromptChange,
  onGenerate,
  onDownload,
}: ControlsProps) {
  return (
    <div className="flex flex-col gap-4 w-full shrink-0">
      <div>
        <h1 className="text-lg font-semibold">OpenThumbail</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Generate a 1920×1080 YouTube thumbnail
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium" htmlFor="api-key">
          Google API Key
        </label>
        <Input
          id="api-key"
          type="password"
          placeholder="AIza..."
          value={apiKey}
          onChange={(e) => onApiKeyChange(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium" htmlFor="prompt">
          Prompt
        </label>
        <Textarea
          id="prompt"
          placeholder="A vibrant thumbnail for a cooking channel, bold title text 'Best Pasta Ever', warm colors..."
          rows={5}
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value)}
        />
      </div>

      <Button
        onClick={onGenerate}
        disabled={loading || !apiKey || !prompt}
        className="gap-2"
      >
        {loading && <Spinner />}
        {loading ? "Generating…" : "Generate Thumbnail"}
      </Button>

      {hasImage && (
        <Button variant="outline" onClick={onDownload}>
          Download PNG
        </Button>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
