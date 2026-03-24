export interface PomMetadata {
  artifactId: string;
  version?: string;
  packaging: string;
  isAggregator: boolean;
  javaVersion?: string;
  buildDirectory?: string;
  finalName?: string;
  modules: string[];
  profiles: Array<{ id: string; activeByDefault: boolean }>;
}

export function parsePom(content: string): PomMetadata {
  const normalized = stripXmlComments(content);
  return {
    artifactId: extractArtifactId(normalized) ?? 'unknown',
    version: extractProjectVersion(normalized),
    packaging: extractProjectTagValue(normalized, 'packaging') ?? 'jar',
    isAggregator: extractTagBlocks(normalized, 'modules').length > 0,
    javaVersion: extractJavaVersion(normalized),
    buildDirectory: extractBuildTagValue(normalized, 'directory'),
    finalName: extractBuildTagValue(normalized, 'finalName'),
    modules: extractModules(normalized),
    profiles: extractProfiles(normalized),
  };
}

function extractTagValue(content: string, tag: string): string | undefined {
  const blocks = extractTagBlocks(content, tag);
  return blocks[0]?.trim() || undefined;
}

function extractArtifactId(content: string): string | undefined {
  return extractProjectTagValue(content, 'artifactId');
}

function extractJavaVersion(content: string): string | undefined {
  return (
    extractTagValue(content, 'maven.compiler.source') ??
    extractTagValue(content, 'maven.compiler.release')
  );
}

function extractProjectVersion(content: string): string | undefined {
  return extractProjectTagValue(content, 'version');
}


function extractBuildTagValue(content: string, tag: string): string | undefined {
  const buildBlock = extractDirectChildTagBlocks(content, 'build')[0];
  if (!buildBlock) {
    return undefined;
  }
  return extractTagValue(buildBlock, tag);
}

function extractModules(content: string): string[] {
  const modulesBlock = extractDirectChildTagBlocks(content, 'modules')[0];
  if (!modulesBlock) {
    return [];
  }

  return extractTagBlocks(modulesBlock, 'module')
    .map((modulePath) => modulePath.trim())
    .filter(Boolean);
}

function extractProfiles(content: string): Array<{ id: string; activeByDefault: boolean }> {
  return extractTagBlocks(content, 'profile')
    .map((profileBlock) => {
      const id = extractTagValue(profileBlock, 'id');
      if (!id) {
        return null;
      }

      return {
        id,
        activeByDefault: extractTagValue(profileBlock, 'activeByDefault') === 'true',
      };
    })
    .filter((profile): profile is { id: string; activeByDefault: boolean } => profile !== null);
}

function extractTagBlocks(content: string, tag: string): string[] {
  const matches = content.matchAll(new RegExp(`<(?:(?:[\\w-]+):)?${escapeRegExp(tag)}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:(?:[\\w-]+):)?${escapeRegExp(tag)}>`, 'g'));
  return [...matches].map((match) => match[1] ?? '');
}

function extractProjectTagValue(content: string, tag: string): string | undefined {
  return extractDirectChildTagBlocks(content, tag)[0]?.trim() || undefined;
}

function extractDirectChildTagBlocks(content: string, tag: string): string[] {
  const projectBlock = extractTagBlocks(content, 'project')[0] ?? content;
  const regex = /<\/?(?:(?:[\w-]+):)?([\w.-]+)(?:\s[^>]*)?>/g;
  const matches: string[] = [];
  let depth = 0;
  let captureStart: number | null = null;

  for (const match of projectBlock.matchAll(regex)) {
    const fullMatch = match[0];
    const tagName = match[1];
    const offset = match.index ?? 0;
    const isClosing = fullMatch.startsWith('</');
    const isSelfClosing = fullMatch.endsWith('/>');

    if (!isClosing) {
      if (depth === 0 && tagName === tag) {
        captureStart = offset + fullMatch.length;
      }
      depth += 1;
      if (isSelfClosing) {
        depth -= 1;
        if (depth === 0 && tagName === tag && captureStart !== null) {
          matches.push('');
          captureStart = null;
        }
      }
      continue;
    }

    depth -= 1;
    if (depth === 0 && tagName === tag && captureStart !== null) {
      matches.push(projectBlock.slice(captureStart, offset));
      captureStart = null;
    }
  }

  return matches;
}

function stripXmlComments(content: string): string {
  return content.replace(/<!--[\s\S]*?-->/g, '');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Alias kept for backward compatibility. */
export const parsePomMetadata = parsePom;
