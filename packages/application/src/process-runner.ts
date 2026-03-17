import type { ProcessEvent } from '@gfos-build/domain';

export interface ProcessRunner {
  spawn(
    executable: string,
    args: string[],
    options: { cwd: string; env?: NodeJS.ProcessEnv; signal?: AbortSignal },
  ): AsyncIterable<ProcessEvent>;
  launchExternal(
    executable: string,
    args: string[],
    options: { cwd: string; env?: NodeJS.ProcessEnv },
  ): AsyncIterable<ProcessEvent>;
}
