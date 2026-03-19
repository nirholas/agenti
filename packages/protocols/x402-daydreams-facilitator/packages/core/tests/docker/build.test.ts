/**
 * Docker Build Tests
 *
 * These tests verify the Docker build process works correctly.
 * They are slower than unit tests and require Docker to be available.
 *
 * Run with: DOCKER_TESTS=true bun test tests/docker/
 *
 * Note: These tests use ports 18090-18091 for container binding. Ensure these
 * ports are available before running.
 */

import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { $ } from "bun";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// Only run if DOCKER_TESTS environment variable is set
const runDockerTests = process.env.DOCKER_TESTS === "true";

// Resolve repo root from this file's location (packages/core/tests/docker/)
const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "../../../..");

describe.skipIf(!runDockerTests)("Docker Build", () => {
  const imageName = "facilitator-test:latest";
  // Unique container names to avoid conflicts if tests run in parallel
  const healthCheckContainer = "facilitator-test-health";
  const staticFilesContainer = "facilitator-test-static";
  let buildSucceeded = false;
  let dockerAvailable = false;

  beforeAll(async () => {
    // Check if Docker is available
    try {
      await $`docker --version`.quiet();
      dockerAvailable = true;
    } catch {
      console.log("Docker not available, skipping tests");
      return;
    }

    // Build the image from repo root
    console.log("Building Docker image...");
    try {
      const result = await $`docker build -t ${imageName} -f Dockerfile .`
        .cwd(REPO_ROOT)
        .quiet();
      buildSucceeded = result.exitCode === 0;
    } catch (error) {
      console.error("Docker build failed:", error);
      buildSucceeded = false;
    }
  });

  afterAll(async () => {
    if (!dockerAvailable) return;

    // Cleanup containers if they exist
    for (const container of [healthCheckContainer, staticFilesContainer]) {
      try {
        await $`docker stop ${container}`.quiet().nothrow();
        await $`docker rm ${container}`.quiet().nothrow();
      } catch {
        // Ignore cleanup errors
      }
    }

    // Cleanup image
    try {
      await $`docker rmi ${imageName}`.quiet().nothrow();
    } catch {
      // Ignore cleanup errors
    }
  });

  it("builds Docker image successfully", () => {
    if (!dockerAvailable) return;
    expect(buildSucceeded).toBe(true);
  });

  it("image contains dist directory", async () => {
    if (!dockerAvailable || !buildSucceeded) return;

    const result =
      await $`docker run --rm ${imageName} ls -la /app/examples/facilitator-server/dist`.text();
    expect(result).toContain("index.js");
  });

  it("image contains public directory", async () => {
    if (!dockerAvailable || !buildSucceeded) return;

    const result =
      await $`docker run --rm ${imageName} ls -la /app/examples/facilitator-server/public`.text();
    expect(result).toContain("index.html");
  });

  it("image contains core package dist", async () => {
    if (!dockerAvailable || !buildSucceeded) return;

    const result =
      await $`docker run --rm ${imageName} ls -la /app/packages/core/dist`.text();
    expect(result).toContain("lib.js");
  });

  it("container starts and responds to health check", async () => {
    if (!dockerAvailable || !buildSucceeded) return;

    // Well-known test private key (address: 0x7E5F4552091A69125d5DfCb7b8C2659029395Bdf)
    // This is intentionally a publicly known key for testing - never use with real funds
    const testPrivateKey =
      "0x0000000000000000000000000000000000000000000000000000000000000001";

    try {
      // Start container in background
      await $`docker run -d --name ${healthCheckContainer} \
        -e EVM_PRIVATE_KEY=${testPrivateKey} \
        -e EVM_NETWORKS=base-sepolia \
        -p 18090:8090 \
        ${imageName}`.quiet();

      // Wait for startup
      await Bun.sleep(5000);

      // Check health endpoint
      const response = await fetch("http://localhost:18090/supported");
      expect(response.ok).toBe(true);

      const data = await response.json();
      expect(data).toBeDefined();
    } finally {
      // Cleanup
      await $`docker stop ${healthCheckContainer}`.quiet().nothrow();
      await $`docker rm ${healthCheckContainer}`.quiet().nothrow();
    }
  });

  it("container serves static files", async () => {
    if (!dockerAvailable || !buildSucceeded) return;

    // Well-known test private key - see comment in previous test
    const testPrivateKey =
      "0x0000000000000000000000000000000000000000000000000000000000000001";

    try {
      // Start container on different port to avoid conflicts
      await $`docker run -d --name ${staticFilesContainer} \
        -e EVM_PRIVATE_KEY=${testPrivateKey} \
        -e EVM_NETWORKS=base-sepolia \
        -p 18091:8090 \
        ${imageName}`.quiet();

      // Wait for startup
      await Bun.sleep(5000);

      // Check root serves index.html
      const response = await fetch("http://localhost:18091/");
      expect(response.ok).toBe(true);
      const html = await response.text();
      expect(html).toContain("html");
    } finally {
      await $`docker stop ${staticFilesContainer}`.quiet().nothrow();
      await $`docker rm ${staticFilesContainer}`.quiet().nothrow();
    }
  });
});
