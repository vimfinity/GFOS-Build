export interface GitInfo {
  branch: string | null;
  isDirty: boolean;
}

export interface GitInfoReader {
  getInfo(path: string): GitInfo;
  getBatch(paths: string[]): Record<string, GitInfo>;
}

/** No-op implementation used when git info is not available (e.g. in tests). */
export const noopGitInfoReader: GitInfoReader = {
  getInfo: () => ({ branch: null, isDirty: false }),
  getBatch: (paths) => Object.fromEntries(paths.map((p) => [p, { branch: null, isDirty: false }])),
};
