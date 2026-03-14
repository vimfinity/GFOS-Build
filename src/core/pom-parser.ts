export interface PomMetadata {
  artifactId: string;
  packaging: string;
  isAggregator: boolean;
  javaVersion?: string;
  modules: string[];
  profiles: Array<{ id: string; activeByDefault: boolean }>;
}

export function parsePom(content: string): PomMetadata {
  const normalized = stripXmlComments(content);
  return {
    artifactId: extractArtifactId(normalized) ?? 'unknown',
    packaging: extractTagValue(normalized, 'packaging') ?? 'jar',
    isAggregator: extractTagBlocks(normalized, 'modules').length > 0,
    javaVersion: extractJavaVersion(normalized),
    modules: extractModules(normalized),
    profiles: extractProfiles(normalized),
  };
}

function extractTagValue(content: string, tag: string): string | undefined {
  const blocks = extractTagBlocks(content, tag);
  return blocks[0]?.trim() || undefined;
}

function extractArtifactId(content: string): string | undefined {
  const parentEnd = content.indexOf('</parent>');
  const searchIn = parentEnd !== -1 ? content.slice(parentEnd) : content;
  return extractTagValue(searchIn, 'artifactId');
}

function extractJavaVersion(content: string): string | undefined {
  return (
    extractTagValue(content, 'maven.compiler.source') ??
    extractTagValue(content, 'maven.compiler.release')
  );
}

function extractModules(content: string): string[] {
  const modulesBlock = extractTagBlocks(content, 'modules')[0];
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

function stripXmlComments(content: string): string {
  return content.replace(/<!--[\s\S]*?-->/g, '');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Alias kept for backward compatibility. */
export const parsePomMetadata = parsePom;
