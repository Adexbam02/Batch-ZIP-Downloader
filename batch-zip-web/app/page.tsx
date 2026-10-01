"use client";

import { useState } from "react";

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [urls, setUrls] = useState("");

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      const links = urls
        .split("\n")
        .map((url) => url.trim())
        .filter(Boolean);

      if (links.length === 0) {
        return;
      }

      const response = await fetch("/api/download", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          urls: links,
        }),
      });

      if (!response.ok) {
        return;
      }
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = "batch-download.zip";
      document.body.appendChild(link);
      link.click();

      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error("Download failed:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-3xl px-6 py-20">
        <div className="mb-10">
          <h1 className="text-4xl font-bold tracking-tight">
            Batch ZIP Downloader
          </h1>

          <p className="mt-3 text-zinc-400">
            Paste multiple authorized download links and package the files into
            one ZIP.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <label htmlFor="urls" className="mb-2 block text-sm font-medium">
            Download URLs
          </label>

          <textarea
            id="urls"
            value={urls}
            onChange={(event) => setUrls(event.target.value)}
            placeholder={`https://example.com/file1.mp4
https://example.com/file2.mp4
https://example.com/file3.pdf`}
            className="min-h-64 w-full resize-y rounded-xl border border-zinc-800 bg-zinc-900 p-4 font-mono text-sm outline-none placeholder:text-zinc-600 focus:border-zinc-600"
          />

          <button
            type="submit"
            disabled={loading}
            className="mt-4 rounded-xl bg-white px-6 py-3 font-medium text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:bg-gray-700"
          >
            {loading ? "Creating ZIP..." : "Create ZIP"}
          </button>
        </form>
      </div>
    </main>
  );
}
