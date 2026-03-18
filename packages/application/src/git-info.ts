export interface GitInfo {
  branch: string | null;
  isDirty: boolean;
}

export interface GitInfoReader {
  getInfo(path: string): GitInfo;
}

/** No-op implementation used when git info is not available (e.g. in tests). */
export const noopGitInfoReader: GitInfoReader = {
  getInfo: () => ({ branch: null, isDirty: false }),
};
