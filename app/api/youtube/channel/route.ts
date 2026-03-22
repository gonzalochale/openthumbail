import { auth } from "@/lib/auth";
import { headers } from "next/headers";

interface YTChannelResponse {
  items?: Array<{
    id: string;
    snippet: { title: string };
  }>;
}

interface YTSearchResponse {
  items?: Array<{
    id: { videoId: string };
    snippet: { title: string };
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

  const base = `https://www.googleapis.com/youtube/v3/channels?part=snippet&key=${apiKey}`;
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

  const channelId = channel.id;

  const searchRes = await fetch(
    `https://www.googleapis.com/youtube/v3/search?channelId=${channelId}&type=video&order=date&maxResults=20&videoDuration=medium&part=snippet&key=${apiKey}`,
  );
  const searchData = (await searchRes.json()) as YTSearchResponse;

  const candidates = (searchData.items ?? []).filter((item) => item.id.videoId);
  if (candidates.length === 0) {
    return Response.json({ handle, thumbnails: [] });
  }

  const ids = candidates.map((item) => item.id.videoId).join(",");
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
    .filter((item) => (durationsById.get(item.id.videoId) ?? 0) > 180)
    .slice(0, 3)
    .map((item) => ({
      videoId: item.id.videoId,
      url: `https://i.ytimg.com/vi/${item.id.videoId}/hqdefault.jpg`,
      title: item.snippet.title,
    }));

  return Response.json({ handle, thumbnails });
}
