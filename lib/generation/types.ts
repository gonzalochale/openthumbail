export interface ReferenceImage {
  imageBase64: string;
  mimeType: string;
}

export interface ChannelRef {
  urls: string[];
  handle: string;
}

export interface VideoRef {
  url: string;
  title?: string;
}

export interface PreviousVersion {
  imageBase64: string;
  mimeType: string;
  enhancedPrompt: string | null;
  cameoUsed?: boolean;
  textThoughtSignature?: string | null;
  imageThoughtSignature?: string | null;
}

export interface PersistGenerationParams {
  generationId: string;
  sessionId: string;
  userId: string;
  prompt: string;
  enhancedPrompt: string;
  base64: string;
  cameoUsed?: boolean;
  previousGenerationId?: string;
  channelRefs?: ChannelRef[];
  videoRefs?: VideoRef[];
  textThoughtSignature?: string | null;
  imageThoughtSignature?: string | null;
}
