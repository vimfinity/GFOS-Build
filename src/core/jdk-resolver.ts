import path from 'node:path';
import type { AppConfig } from '../config/schema.js';
import type { FileSystem } from '../infrastructure/file-system.js';

/**
 * Look up a JDK path from the registry by version string.
 */
export function resolveJavaHome(
  config: AppConfig,
  javaVersion: string | undefined,
): string | undefined {
  if (!javaVersion) return undefined;
  return config.jdkRegistry[javaVersion];
}

/**
 * Build a JAVA_HOME-augmented env object, or undefined if no override needed.
 */
export function buildEnvWithJavaHome(
  javaHome: string | undefined,
): NodeJS.ProcessEnv | undefined {
  if (!javaHome) return undefined;
  return { ...process.env, JAVA_HOME: javaHome };
}

// ---------------------------------------------------------------------------
// JDK auto-detection
// ---------------------------------------------------------------------------

export interface DetectedJdk {
  version: string;
  path: string;
}

/**
 * Scan a base directory for JDK installations.
 * Looks for directories containing bin/javac (or bin/javac.exe on Windows),
 * then reads the `release` file to extract the major version.
 */
export async function detectJdks(baseDir: string, fs: FileSystem): Promise<DetectedJdk[]> {
  const results: DetectedJdk[] = [];

  if (!(await fs.exists(baseDir))) return results;

  let entries;
  try {
    entries = await fs.readDir(baseDir);
  } catch {
    return results;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const jdkDir = path.join(baseDir, entry.name);
    const javacPath = path.join(jdkDir, 'bin', process.platform === 'win32' ? 'javac.exe' : 'javac');

    if (!(await fs.exists(javacPath))) continue;

    // Try reading the release file for version info
    const releasePath = path.join(jdkDir, 'release');
    let version: string | undefined;

    if (await fs.exists(releasePath)) {
      try {
        const content = await fs.readFile(releasePath);
        version = parseJavaVersion(content);
      } catch {
        // Non-fatal — fall back to directory name
      }
    }

    if (!version) {
      // Fall back to inferring from directory name
      version = inferVersionFromName(entry.name);
    }

    if (version) {
      results.push({ version, path: jdkDir });
    }
  }

  return results.sort((a, b) => Number(a.version) - Number(b.version));
}

/**
 * Parse the JAVA_VERSION from a JDK `release` file.
 * Handles both modern (21.0.1) and legacy (1.8.0_382) formats.
 */
export function parseJavaVersion(releaseContent: string): string | undefined {
  const match = releaseContent.match(/JAVA_VERSION="([^"]+)"/);
  if (!match?.[1]) return undefined;

  const raw = match[1];

  // Legacy format: 1.8.0_382 → "8"
  if (raw.startsWith('1.')) {
    const parts = raw.split('.');
    return parts[1];
  }

  // Modern format: 21.0.1 → "21"
  const parts = raw.split('.');
  return parts[0];
}

function inferVersionFromName(name: string): string | undefined {
  // Match common JDK directory naming patterns: jdk21, jdk-17, jdk1.8, etc.
  const match = name.match(/(?:jdk|java)[_-]?(\d+)/i);
  return match?.[1];
}
