import fs from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";

const DOWNLOAD_DIR = path.join(process.cwd(), "downloads");

const MAX_RETRIES = 3;
const TIMEOUT_MS = 30_000;

export async function downloadFile(
  url: string,
  index: number,
): Promise<string> {
  fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });

  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(
        `\n⬇️ Downloading file ${index} ` +
          `(attempt ${attempt}/${MAX_RETRIES})`,
      );

      return await performDownload(url, index);
    } catch (error) {
      lastError = error;

      console.error(
        `❌ Attempt ${attempt} failed:`,
        error instanceof Error ? error.message : error,
      );

      if (attempt < MAX_RETRIES) {
        console.log("🔄 Retrying in 2 seconds...");
        await sleep(2000);
      }
    }
  }

  throw lastError;
}

async function performDownload(url: string, index: number): Promise<string> {
  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    if (!response.body) {
      throw new Error("The server returned no file data.");
    }

    const filename = getUniqueFilename(
      getFilename(url, response.headers.get("content-type"), index),
    );

    const filePath = path.join(DOWNLOAD_DIR, filename);

    const totalBytes = Number(response.headers.get("content-length") ?? 0);

    let downloadedBytes = 0;
    let lastShownPercent = -1;

    const stream = Readable.fromWeb(
      response.body as Parameters<typeof Readable.fromWeb>[0],
    );

    const progressStream = new Readable({
      read() {},
    });

    stream.on("data", (chunk: Buffer) => {
      downloadedBytes += chunk.length;

      if (totalBytes > 0) {
        const percent = Math.floor((downloadedBytes / totalBytes) * 100);

        if (percent !== lastShownPercent) {
          lastShownPercent = percent;

          process.stdout.write(
            `\r📥 File ${index}: ${createProgressBar(percent)} ` +
              `${percent}% ` +
              `(${formatBytes(downloadedBytes)} / ` +
              `${formatBytes(totalBytes)})`,
          );
        }
      } else {
        process.stdout.write(
          `\r📥 File ${index}: ${formatBytes(downloadedBytes)}`,
        );
      }

      progressStream.push(chunk);
    });

    stream.on("end", () => {
      progressStream.push(null);
    });

    stream.on("error", (error) => {
      progressStream.destroy(error);
    });

    const fileStream = fs.createWriteStream(filePath);

    await pipeline(progressStream, fileStream);

    process.stdout.write("\n");

    console.log(`✅ Saved: ${filename}`);

    return filePath;
  } finally {
    clearTimeout(timeout);
  }
}

function createProgressBar(percent: number): string {
  const width = 20;

  const completed = Math.round((percent / 100) * width);

  return "█".repeat(completed) + "░".repeat(width - completed);
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";

  const units = ["B", "KB", "MB", "GB"];

  const unitIndex = Math.floor(Math.log(bytes) / Math.log(1024));

  const value = bytes / Math.pow(1024, unitIndex);

  return `${value.toFixed(2)} ${units[unitIndex]}`;
}

function getFilename(
  url: string,
  contentType: string | null,
  index: number,
): string {
  try {
    const parsedUrl = new URL(url);

    const filename = path.basename(parsedUrl.pathname);

    if (filename && filename.includes(".")) {
      return filename;
    }

    return `file-${index}${getExtension(contentType)}`;
  } catch {
    return `file-${index}`;
  }
}

function getUniqueFilename(filename: string): string {
  const extension = path.extname(filename);

  const basename = path.basename(filename, extension);

  let candidate = filename;
  let counter = 1;

  while (fs.existsSync(path.join(DOWNLOAD_DIR, candidate))) {
    candidate = `${basename}-${counter}${extension}`;

    counter++;
  }

  return candidate;
}

function getExtension(contentType: string | null): string {
  if (!contentType) return "";

  const type = contentType.split(";")[0].trim();

  const extensions: Record<string, string> = {
    "video/mp4": ".mp4",
    "video/webm": ".webm",
    "video/x-matroska": ".mkv",
    "audio/mpeg": ".mp3",
    "audio/wav": ".wav",
    "application/pdf": ".pdf",
    "application/zip": ".zip",
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
  };

  return extensions[type] ?? "";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
