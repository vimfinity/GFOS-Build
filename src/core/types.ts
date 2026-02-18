export interface ScanOptions {
  rootPaths: string[];
  maxDepth: number;
  includeHidden: boolean;
}

export interface MavenRepository {
  name: string;
  path: string;
  pomPath: string;
  depth: number;
}

export interface BuildOptions {
  goals: string[];
  mavenExecutable: string;
  failFast: boolean;
}

export interface BuildResult {
  repository: MavenRepository;
  exitCode: number;
  durationMs: number;
}

export interface RunSummary {
  discovered: MavenRepository[];
  buildResults: BuildResult[];
}
