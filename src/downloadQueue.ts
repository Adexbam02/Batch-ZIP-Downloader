import { downloadFile } from "./downloader.js";

const MAX_CONCURRENT_DOWNLOADS = 3;

export async function downloadAll(urls: string[]): Promise<string[]> {
  const results: string[] = [];

  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (true) {
      const currentIndex = nextIndex++;

      if (currentIndex >= urls.length) {
        return;
      }

      const url = urls[currentIndex];

      try {
        const filePath = await downloadFile(url, currentIndex + 1);

        results[currentIndex] = filePath;
      } catch (error) {
        console.error(`❌ File ${currentIndex + 1} failed permanently.`);
      }
    }
  }

  const workers = Array.from(
    {
      length: Math.min(MAX_CONCURRENT_DOWNLOADS, urls.length),
    },
    () => worker(),
  );

  await Promise.all(workers);

  return results.filter(Boolean);
}
