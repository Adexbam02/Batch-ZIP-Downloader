import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { downloadFile } from "./downloader.js";
import { downloadAll } from "./downloadQueue.js";

import { createZip } from "./zipper.js";

const rl = readline.createInterface({ input, output });

console.log("=== Batch ZIP Downloader ===");
console.log("Paste your download URLs, one per line.");
console.log("Press ENTER on an empty line when you're done.\n");

const urls: string[] = [];

function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value);

    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

while (true) {
  const url = await rl.question("URL: ");

  if (!url.trim()) {
    break;
  }

  const cleanUrl = url.trim();

  if (!isValidUrl(cleanUrl)) {
    console.log("❌ Invalid URL. Please enter a valid HTTP/HTTPS URL.");
    continue;
  }

  urls.push(cleanUrl);
}

console.log("\nURLs received:");

urls.forEach((url, index) => {
  console.log(`${index + 1}. ${url}`);
});

console.log(`\nTotal URLs: ${urls.length}`);

const downloadedFiles = await downloadAll(urls);

if (downloadedFiles.length === 0) {
  console.log("No files were successfully downloaded.");
  process.exit(1);
}

const zipName = await rl.question("\nEnter a name for the ZIP file: ");

const finalZip = await createZip(
  downloadedFiles,
  zipName.trim() || "batch-download",
);

console.log("\n==============================");
console.log("Everything is ready!");
console.log("==============================");

console.log(`📦 ZIP: ${finalZip}`);

console.log("\n==============================");
console.log("Download complete!");
console.log("==============================");

console.log(
  `Successfully downloaded: ${downloadedFiles.length}/${urls.length}`,
);

downloadedFiles.forEach((file, index) => {
  console.log(`${index + 1}. ${file}`);
});

rl.close();
