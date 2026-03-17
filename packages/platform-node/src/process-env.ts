export function buildChildProcessEnv(overrides?: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env };
  delete env.NODE_ENV;

  if (!overrides) {
    return env;
  }

  return { ...env, ...overrides };
}
