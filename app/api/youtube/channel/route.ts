import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { ytThumbnailUrl } from "@/lib/youtube";

interface YTChannelResponse {
  items?: Array<{
    id: string;
    snippet: { title: string };
    contentDetails: {
      relatedPlaylists: { uploads: string };
    };
  }>;
}

interface YTPlaylistItemsResponse {
  items?: Array<{
    snippet: {
      resourceId: { videoId: string };
      title: string;
    };
  }>;
}

interface YTVideosResponse {
  items?: Array<{
    id: string;
    contentDetails: { duration: string };
  }>;
}

function isoToSeconds(iso: string): number {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return (
    parseInt(m[1] ?? "0") * 3600 +
    parseInt(m[2] ?? "0") * 60 +
    parseInt(m[3] ?? "0")
  );
}

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session)
    return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const handle = searchParams.get("handle")?.replace(/^@/, "");

  if (!handle) {
    return Response.json({ error: "handle is required" }, { status: 400 });
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "YouTube API not configured" },
      { status: 500 },
    );
  }

  const base = `https://www.googleapis.com/youtube/v3/channels?part=snippet,contentDetails&key=${apiKey}`;
  const [handleRes, usernameRes] = await Promise.all([
    fetch(`${base}&forHandle=@${encodeURIComponent(handle)}`),
    fetch(`${base}&forUsername=${encodeURIComponent(handle)}`),
  ]);
  const [handleData, usernameData] = (await Promise.all([
    handleRes.json(),
    usernameRes.json(),
  ])) as [
    YTChannelResponse & { error?: unknown },
    YTChannelResponse & { error?: unknown },
  ];

  if (handleData.error || usernameData.error) {
    const apiError = handleData.error ?? usernameData.error;
    console.error("[youtube/channel] API error:", JSON.stringify(apiError));
    return Response.json({ error: "YouTube API error" }, { status: 502 });
  }

  const channel = handleData.items?.[0] ?? usernameData.items?.[0];
  if (!channel) {
    return Response.json({ error: "Channel not found" }, { status: 404 });
  }

  const uploadsPlaylistId =
    channel.contentDetails?.relatedPlaylists?.uploads;
  if (!uploadsPlaylistId) {
    return Response.json({ handle, thumbnails: [] });
  }

  const playlistRes = await fetch(
    `https://www.googleapis.com/youtube/v3/playlistItems?playlistId=${encodeURIComponent(uploadsPlaylistId)}&maxResults=20&part=snippet&key=${apiKey}`,
  );
  const playlistData = (await playlistRes.json()) as YTPlaylistItemsResponse & {
    error?: unknown;
  };

  if (playlistData.error) {
    console.error(
      "[youtube/channel] playlistItems API error:",
      JSON.stringify(playlistData.error),
    );
    return Response.json({ error: "YouTube API error" }, { status: 502 });
  }

  const candidates = (playlistData.items ?? []).filter(
    (item) => item.snippet.resourceId.videoId,
  );
  if (candidates.length === 0) {
    return Response.json({ handle, thumbnails: [] });
  }

  const ids = candidates
    .map((item) => item.snippet.resourceId.videoId)
    .join(",");
  const videosRes = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?id=${ids}&part=contentDetails&key=${apiKey}`,
  );
  const videosData = (await videosRes.json()) as YTVideosResponse;

  const durationsById = new Map(
    (videosData.items ?? []).map((v) => [
      v.id,
      isoToSeconds(v.contentDetails.duration),
    ]),
  );

  const thumbnails = candidates
    .map((item) => ({
      videoId: item.snippet.resourceId.videoId,
      title: item.snippet.title,
    }))
    .filter((item) => (durationsById.get(item.videoId) ?? 0) > 180)
    .slice(0, 3)
    .map((item) => ({
      videoId: item.videoId,
      url: ytThumbnailUrl(item.videoId),
      title: item.title,
    }));

  return Response.json({ handle, thumbnails });
}
