export interface PomMetadata {
  artifactId: string;
  packaging: string;
  isAggregator: boolean;
  javaVersion?: string;
}

export function parsePom(content: string): PomMetadata {
  return {
    artifactId: extractArtifactId(content) ?? 'unknown',
    packaging: extractTagValue(content, 'packaging') ?? 'jar',
    isAggregator: content.includes('<modules>'),
    javaVersion: extractJavaVersion(content),
  };
}

function extractTagValue(content: string, tag: string): string | undefined {
  const open = `<${tag}>`;
  const close = `</${tag}>`;
  const start = content.indexOf(open);
  if (start === -1) return undefined;
  const end = content.indexOf(close, start);
  if (end === -1) return undefined;
  return content.slice(start + open.length, end).trim();
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

/** Alias kept for backward compatibility. */
export const parsePomMetadata = parsePom;
