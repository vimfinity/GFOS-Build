import path from 'node:path';
import type { FileSystem } from './file-system.js';

/**
 * Look up a JDK path from the registry by version string.
 */
export function resolveJavaHome(
  config: { jdkRegistry: Record<string, string> },
  javaVersion: string | undefined,
): string | undefined {
  if (!javaVersion) return undefined;
  return config.jdkRegistry[javaVersion];
}

export function requireRegisteredJavaHome(
  config: { jdkRegistry: Record<string, string> },
  javaVersion: string | undefined,
): string | undefined {
  if (!javaVersion) return undefined;

  const javaHome = resolveJavaHome(config, javaVersion);
  if (!javaHome) {
    throw new Error(
      `Java version "${javaVersion}" is not registered in the JDK registry. Add it in Settings before selecting it as a JAVA_HOME override.`,
    );
  }

  return javaHome;
}

/**
 * Build a JAVA_HOME-augmented env object, or undefined if no override needed.
 */
export function buildEnvWithJavaHome(
  javaHome: string | undefined,
): NodeJS.ProcessEnv | undefined {
  if (!javaHome) return undefined;
  return buildChildProcessEnv({ JAVA_HOME: javaHome });
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
  const results = new Map<string, DetectedJdk>();

  if (!(await fs.exists(baseDir))) return [];

  const selfDetected = await inspectJdkHome(baseDir, path.basename(baseDir), fs);
  if (selfDetected) {
    results.set(selfDetected.version, selfDetected);
  }

  let entries;
  try {
    entries = await fs.readDir(baseDir);
  } catch {
    return Array.from(results.values()).sort((a, b) => Number(a.version) - Number(b.version));
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const detected = await inspectJdkHome(path.join(baseDir, entry.name), entry.name, fs);
    if (!detected || results.has(detected.version)) continue;
    results.set(detected.version, detected);
  }

  return Array.from(results.values()).sort((a, b) => Number(a.version) - Number(b.version));
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

async function inspectJdkHome(
  jdkDir: string,
  fallbackName: string,
  fs: FileSystem,
): Promise<DetectedJdk | undefined> {
  const javacPath = path.join(jdkDir, 'bin', process.platform === 'win32' ? 'javac.exe' : 'javac');
  if (!(await fs.exists(javacPath))) return undefined;

  const releasePath = path.join(jdkDir, 'release');
  let version: string | undefined;

  if (await fs.exists(releasePath)) {
    try {
      const content = await fs.readFile(releasePath);
      version = parseJavaVersion(content);
    } catch {
      // Non-fatal — fall back to directory name.
    }
  }

  if (!version) {
    version = inferVersionFromName(fallbackName);
  }

  return version ? { version, path: jdkDir } : undefined;
}

function buildChildProcessEnv(overrides?: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env };
  delete env.NODE_ENV;
  return overrides ? { ...env, ...overrides } : env;
}
