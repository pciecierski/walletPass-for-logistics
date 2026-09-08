import fs from "node:fs";
import path from "node:path";

const PRODUCTION_DATA_DIR = "/data";
const RELATIVE_DATA_LEFTOVERS = new Set(["data", "./data", ".\\data", "data/", "./data/"]);

function resolvePath(maybePath: string | undefined, fallback: string): string {
  if (!maybePath) return fallback;
  return path.isAbsolute(maybePath) ? maybePath : path.resolve(process.cwd(), maybePath);
}

/** True when `dir` is on a dedicated Linux mount (not the container root filesystem). */
export function isPathOnDedicatedMount(dir: string): boolean {
  try {
    const resolved = path.resolve(dir);
    const mounts = fs.readFileSync("/proc/mounts", "utf8").split("\n");
    for (const line of mounts) {
      const raw = line.split(/\s+/)[1];
      if (!raw || raw === "/") continue;
      const mountPoint = decodeURIComponent(raw.replace(/\\040/g, " "));
      if (resolved === mountPoint || resolved.startsWith(`${mountPoint}/`)) {
        return true;
      }
    }
  } catch {
    // Windows / missing /proc/mounts
  }
  return false;
}

export function probeDirWritable(dir: string): boolean {
  try {
    fs.mkdirSync(dir, { recursive: true });
    const probe = path.join(dir, `.writable-${process.pid}`);
    fs.writeFileSync(probe, "ok");
    fs.unlinkSync(probe);
    return true;
  } catch {
    return false;
  }
}

function isRelativeLeftover(value: string): boolean {
  return RELATIVE_DATA_LEFTOVERS.has(value.trim().replace(/\\/g, "/"));
}

/**
 * Where pass files, logos and auth live.
 *
 * Railway volume at `/data` always wins — even if a leftover `DATA_DIR=./data`
 * variable would otherwise write into the ephemeral container filesystem.
 */
export function resolveDataDir(env: NodeJS.ProcessEnv = process.env): {
  dataDir: string;
  persistent: boolean;
  volumeMountPath?: string;
} {
  const volumeMountPath = env.RAILWAY_VOLUME_MOUNT_PATH?.trim() || undefined;
  const explicit = env.DATA_DIR?.trim();
  const production = env.NODE_ENV === "production";

  if (volumeMountPath) {
    const dataDir = path.isAbsolute(volumeMountPath)
      ? volumeMountPath
      : path.resolve(process.cwd(), volumeMountPath);
    return { dataDir, persistent: true, volumeMountPath: dataDir };
  }

  if (explicit && !(production && isRelativeLeftover(explicit))) {
    const dataDir = resolvePath(explicit, path.join(process.cwd(), "data"));
    const persistent =
      dataDir === PRODUCTION_DATA_DIR ||
      dataDir.startsWith(`${PRODUCTION_DATA_DIR}/`) ||
      isPathOnDedicatedMount(dataDir);
    return { dataDir, persistent, volumeMountPath };
  }

  if (production) {
    return {
      dataDir: PRODUCTION_DATA_DIR,
      persistent: isPathOnDedicatedMount(PRODUCTION_DATA_DIR),
      volumeMountPath,
    };
  }

  return {
    dataDir: path.join(process.cwd(), "data"),
    persistent: false,
    volumeMountPath,
  };
}

export function ensureDataLayout(dataDir: string): void {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(path.join(dataDir, "passes"), { recursive: true });
  fs.mkdirSync(path.join(dataDir, "auth"), { recursive: true });
  if (!probeDirWritable(dataDir)) {
    throw new Error(
      `Data directory is not writable: ${dataDir}. Mount a Railway volume at /data and keep DATA_DIR=/data.`,
    );
  }
}
