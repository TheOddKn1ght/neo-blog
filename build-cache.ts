import { createHash } from "node:crypto";
import {
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";

type Entry = { key: string; outputs: Record<string, string> };

export async function filesUnder(root: string): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  const files: string[] = [];
  for (const entry of entries) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) files.push(...(await filesUnder(path)));
    else files.push(path);
  }
  return files.sort();
}

export function fingerprint(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

export async function fingerprintFiles(files: string[]): Promise<string> {
  const values = await Promise.all(
    [...files]
      .sort()
      .map(async (file) => [file, fingerprint(await readFile(file))]),
  );
  return fingerprint(JSON.stringify(values));
}

export class BuildCache {
  private entries: Record<string, Entry> = {};
  private used = new Set<string>();
  rebuilt = 0;
  reused = 0;

  constructor(
    private output: string,
    private manifest: string,
    private version: string,
  ) {}

  async load(): Promise<boolean> {
    try {
      const saved = JSON.parse(await readFile(this.manifest, "utf8"));
      if (
        saved.version !== this.version ||
        !saved.entries ||
        typeof saved.entries !== "object"
      )
        return false;
      for (const entry of Object.values(saved.entries) as Entry[]) {
        if (
          typeof entry.key !== "string" ||
          !entry.outputs ||
          typeof entry.outputs !== "object"
        )
          return false;
        for (const [path, hash] of Object.entries(entry.outputs)) {
          if (!this.safePath(path) || typeof hash !== "string") return false;
        }
      }
      this.entries = saved.entries;
      return true;
    } catch {
      return false;
    }
  }

  private safePath(path: string): boolean {
    const name = relative(this.output, resolve(this.output, path));
    return (
      name !== "" &&
      name !== ".." &&
      !name.startsWith("../") &&
      !name.startsWith("/")
    );
  }

  async run(
    id: string,
    key: string,
    build: () => Promise<string[]>,
  ): Promise<void> {
    this.used.add(id);
    const previous = this.entries[id];
    if (previous?.key === key) {
      const intact = await Promise.all(
        Object.entries(previous.outputs).map(async ([path, hash]) => {
          try {
            return (
              fingerprint(await readFile(join(this.output, path))) === hash
            );
          } catch {
            return false;
          }
        }),
      );
      if (intact.every(Boolean)) {
        this.reused++;
        return;
      }
    }
    const paths = await build();
    const outputs: Record<string, string> = {};
    for (const path of paths) {
      const name = relative(this.output, path);
      if (!this.safePath(name))
        throw new Error(`Build output outside dist: ${path}`);
      outputs[name] = fingerprint(await readFile(path));
    }
    this.entries[id] = { key, outputs };
    for (const path of Object.keys(previous?.outputs ?? {})) {
      if (!(path in outputs))
        await rm(join(this.output, path), { force: true });
    }
    this.rebuilt++;
  }

  async save(): Promise<void> {
    const activeOutputs = new Set(
      Object.entries(this.entries)
        .filter(([id]) => this.used.has(id))
        .flatMap(([, entry]) => Object.keys(entry.outputs)),
    );
    for (const [id, entry] of Object.entries(this.entries)) {
      if (this.used.has(id)) continue;
      for (const path of Object.keys(entry.outputs)) {
        if (!activeOutputs.has(path))
          await rm(join(this.output, path), { force: true });
      }
      delete this.entries[id];
    }
    await mkdir(dirname(this.manifest), { recursive: true });
    const temporary = `${this.manifest}.tmp`;
    await writeFile(
      temporary,
      JSON.stringify({ version: this.version, entries: this.entries }),
    );
    await rename(temporary, this.manifest);
  }
}
