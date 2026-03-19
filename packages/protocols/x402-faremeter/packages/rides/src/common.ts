export async function readLocalFile(path: string) {
  let fs;
  try {
    fs = await import("fs/promises");
  } catch (_) {
    return undefined;
  }

  try {
    const contents = await fs.readFile(path, "utf8");
    return contents;
  } catch (e: unknown) {
    if (e instanceof Error && "code" in e && e.code === "ENOENT") {
      return undefined;
    } else {
      throw e;
    }
  }
}
