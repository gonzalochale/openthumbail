import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { ytThumbnailUrl } from "@/lib/youtube";

interface YTVideoResponse {
  items?: Array<{
    id: string;
    snippet: {
      title: string;
      thumbnails: {
        high?: { url: string };
        medium?: { url: string };
        default?: { url: string };
      };
    };
  }>;
  error?: unknown;
}

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session)
    return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const videoId = searchParams.get("videoId");

  if (!videoId) {
    return Response.json({ error: "videoId is required" }, { status: 400 });
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "YouTube API not configured" },
      { status: 500 },
    );
  }

  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?id=${encodeURIComponent(videoId)}&part=snippet&key=${apiKey}`,
  );
  const data = (await res.json()) as YTVideoResponse;

  if (data.error) {
    console.error("[youtube/video] API error:", JSON.stringify(data.error));
    return Response.json({ error: "YouTube API error" }, { status: 502 });
  }

  const video = data.items?.[0];
  if (!video) {
    return Response.json({ error: "Video not found" }, { status: 404 });
  }

  const thumbnailUrl =
    video.snippet.thumbnails.high?.url ??
    video.snippet.thumbnails.medium?.url ??
    ytThumbnailUrl(videoId);

  return Response.json({
    videoId,
    title: video.snippet.title,
    thumbnailUrl,
  });
}
