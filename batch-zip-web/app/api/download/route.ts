import { Readable } from "node:stream";
import { ZipArchive } from "archiver";

// Helper to sanitize and deduplicate filenames within the archive
function getUniqueFilename(
  urlStr: string,
  index: number,
  usedNames: Set<string>,
): string {
  let name = `file-${index + 1}`;
  try {
    const parsed = new URL(urlStr);
    const basename = parsed.pathname.split("/").filter(Boolean).pop();
    if (basename) {
      name = decodeURIComponent(basename);
    }
  } catch {
    // If malformed, keep fallback name
  }

  // Handle duplicate filenames (e.g. data.csv -> data-1.csv)
  let finalName = name;
  let counter = 1;
  const dotIndex = name.lastIndexOf(".");
  const base = dotIndex > 0 ? name.slice(0, dotIndex) : name;
  const ext = dotIndex > 0 ? name.slice(dotIndex) : "";

  while (usedNames.has(finalName)) {
    finalName = `${base}-${counter}${ext}`;
    counter++;
  }
  usedNames.add(finalName);

  return finalName;
}

export async function POST(request: Request) {
  let body: { urls?: unknown };
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  const urls = body.urls;
  if (!Array.isArray(urls) || urls.length === 0) {
    return new Response("Invalid or empty 'urls' array", { status: 400 });
  }

  // Filter only non-empty string URLs
  const validUrls = urls.filter(
    (u): u is string => typeof u === "string" && u.trim().length > 0,
  );
  if (validUrls.length === 0) {
    return new Response("No valid URL strings provided", { status: 400 });
  }

  // Level 6 provides near-optimal compression with significantly lower CPU usage than 9
  const archive = new ZipArchive({ zlib: { level: 6 } });
  const webStream = Readable.toWeb(archive as any) as unknown as BodyInit;

  // Background producer: streams fetched files directly into the archive
  (async () => {
    const usedNames = new Set<string>();

    try {
      for (let i = 0; i < validUrls.length; i++) {
        const url = validUrls[i];

        try {
          const res = await fetch(url, { signal: request.signal });
          if (!res.ok || !res.body) {
            console.warn(
              `[Skip] Failed to fetch ${url} (status: ${res.status})`,
            );
            continue;
          }

          const filename = getUniqueFilename(url, i, usedNames);
          const nodeStream = Readable.fromWeb(res.body as any);

          // Pipe the fetch body directly into archiver without buffering into RAM
          await new Promise<void>((resolve, reject) => {
            nodeStream.on("end", resolve);
            nodeStream.on("error", reject);
            archive.append(nodeStream, { name: filename });
          });
        } catch (fetchErr) {
          // If the user cancelled/closed the download, stop immediately
          if (request.signal.aborted) {
            break;
          }
          console.warn(`[Skip] Error downloading ${url}:`, fetchErr);
        }
      }

      await archive.finalize();
    } catch (err) {
      archive.destroy(err as Error);
    }
  })();

  return new Response(webStream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": 'attachment; filename="batch-download.zip"',
    },
  });
}
