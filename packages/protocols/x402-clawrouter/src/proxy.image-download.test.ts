/**
 * Tests that HTTP image URLs (DALL-E 3 style) are downloaded and saved locally.
 */
import { createServer } from "http";
import { mkdir, readFile, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { describe, it, expect, afterEach } from "vitest";

// Minimal 1×1 transparent PNG (67 bytes)
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

async function serveTinyPng(): Promise<{ url: string; close: () => void }> {
  return new Promise((resolve) => {
    const srv = createServer((req, res) => {
      res.writeHead(200, { "content-type": "image/png", "content-length": TINY_PNG.length });
      res.end(TINY_PNG);
    });
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address() as { port: number };
      resolve({ url: `http://127.0.0.1:${port}/test.png`, close: () => srv.close() });
    });
  });
}

describe("image HTTP download logic", () => {
  const testDir = join(tmpdir(), `clawrouter-img-test-${process.pid}`);

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it("downloads an HTTP image URL and saves it to disk", async () => {
    const { url, close } = await serveTinyPng();
    try {
      await mkdir(testDir, { recursive: true });

      // Replicate the exact download logic from proxy.ts
      const imgResp = await fetch(url);
      expect(imgResp.ok).toBe(true);

      const contentType = imgResp.headers.get("content-type") ?? "image/png";
      const ext =
        contentType.includes("jpeg") || contentType.includes("jpg")
          ? "jpg"
          : contentType.includes("webp")
            ? "webp"
            : "png";
      const filename = `${Date.now()}-test.${ext}`;
      const buf = Buffer.from(await imgResp.arrayBuffer());
      const filePath = join(testDir, filename);

      const { writeFile } = await import("fs/promises");
      await writeFile(filePath, buf);

      // Verify file exists and has correct content
      const saved = await readFile(filePath);
      expect(saved.length).toBeGreaterThan(0);
      expect(saved.equals(TINY_PNG)).toBe(true);
      expect(ext).toBe("png");
    } finally {
      close();
    }
  });

  it("uses jpg extension for jpeg content-type", async () => {
    const srv = createServer((req, res) => {
      res.writeHead(200, { "content-type": "image/jpeg" });
      res.end(TINY_PNG);
    });
    await new Promise<void>((resolve) => srv.listen(0, "127.0.0.1", resolve));
    const { port } = srv.address() as { port: number };

    try {
      const imgResp = await fetch(`http://127.0.0.1:${port}/img.jpg`);
      const contentType = imgResp.headers.get("content-type") ?? "image/png";
      const ext =
        contentType.includes("jpeg") || contentType.includes("jpg")
          ? "jpg"
          : contentType.includes("webp")
            ? "webp"
            : "png";
      expect(ext).toBe("jpg");
    } finally {
      srv.close();
    }
  });

  it("passes through URL unchanged if download fails", async () => {
    const originalUrl = "https://unreachable.invalid/image.png";
    let resultUrl = originalUrl;

    try {
      const imgResp = await fetch(originalUrl);
      if (imgResp.ok) {
        resultUrl = "http://localhost:8402/images/saved.png";
      }
    } catch {
      // download failed — URL stays unchanged (warn only, no throw)
    }

    expect(resultUrl).toBe(originalUrl);
  });
});
