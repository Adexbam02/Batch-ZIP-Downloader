import fs from "node:fs";
import path from "node:path";
import { ZipArchive } from "archiver";

const OUTPUT_DIR = path.join(process.cwd(), "output");

export async function createZip(
  files: string[],
  zipName: string,
): Promise<string> {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const zipPath = path.join(OUTPUT_DIR, `${zipName}.zip`);

  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);

    const archive = new ZipArchive({
      zlib: { level: 9 },
    });

    output.on("close", () => {
      console.log(`\n📦 ZIP created: ${archive.pointer()} bytes`);

      resolve(zipPath);
    });

    archive.on("error", (error: any) => {
      reject(error);
    });

    archive.pipe(output);

    for (const file of files) {
      archive.file(file, {
        name: path.basename(file),
      });
    }

    archive.finalize();
  });
}
