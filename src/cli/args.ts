export type Command =
  | { name: 'build'; path: string; goals?: string[]; flags?: string[]; maven?: string; java?: string; dryRun: boolean }
  | { name: 'pipeline:run'; pipelineName: string; from?: string; continue: boolean; dryRun: boolean }
  | { name: 'pipeline:list' }
  | { name: 'scan'; path?: string; noCache: boolean }
  | { name: 'serve'; port: number }
  | { name: 'config:init' }
  | { name: 'config:show' }
  | { name: 'version' }
  | { name: 'help'; topic?: string };

export interface GlobalOptions {
  config?: string;
  json: boolean;
}

export interface ParsedArgs {
  command: Command;
  global: GlobalOptions;
}

export function parseArgs(argv: string[]): ParsedArgs {
  const args = argv.slice(2);
  const global: GlobalOptions = { json: false };
  const rest: string[] = [];

  // Extract global options
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === '--json') {
      global.json = true;
    } else if (arg === '--config' && i + 1 < args.length) {
      global.config = args[++i]!;
    } else {
      rest.push(arg);
    }
  }

  if (rest.length === 0 || rest[0] === 'help' || rest[0] === '--help' || rest[0] === '-h') {
    return { command: { name: 'help', topic: rest[1] }, global };
  }

  if (rest[0] === 'version' || rest[0] === '--version' || rest[0] === '-v') {
    return { command: { name: 'version' }, global };
  }

  if (rest[0] === 'config') {
    if (rest[1] === 'init') return { command: { name: 'config:init' }, global };
    if (rest[1] === 'show') return { command: { name: 'config:show' }, global };
    return { command: { name: 'help', topic: 'config' }, global };
  }

  if (rest[0] === 'pipeline') {
    if (rest[1] === 'list') return { command: { name: 'pipeline:list' }, global };
    if (rest[1] === 'run') return parsePipelineRun(rest.slice(2), global);
    return { command: { name: 'help', topic: 'pipeline' }, global };
  }

  if (rest[0] === 'scan') return parseScan(rest.slice(1), global);
  if (rest[0] === 'build') return parseBuild(rest.slice(1), global);
  if (rest[0] === 'serve') return parseServe(rest.slice(1), global);

  // Unknown command — show help
  return { command: { name: 'help' }, global };
}

function parseBuild(args: string[], global: GlobalOptions): ParsedArgs {
  let pathArg: string | undefined;
  let goals: string[] | undefined;
  let flags: string[] | undefined;
  let maven: string | undefined;
  let java: string | undefined;
  let dryRun = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === '--goals' && i + 1 < args.length) {
      goals = args[++i]!.split(/\s+/);
    } else if (arg === '--flags' && i + 1 < args.length) {
      flags = args[++i]!.split(/\s+/);
    } else if (arg === '--maven' && i + 1 < args.length) {
      maven = args[++i]!;
    } else if (arg === '--java' && i + 1 < args.length) {
      java = args[++i]!;
    } else if (arg === '--dry-run') {
      dryRun = true;
    } else if (!arg.startsWith('-') && !pathArg) {
      pathArg = arg;
    }
  }

  if (!pathArg) {
    throw new Error('build command requires a path argument. Usage: gfos-build build <path> [options]');
  }

  return { command: { name: 'build', path: pathArg, goals, flags, maven, java, dryRun }, global };
}

function parsePipelineRun(args: string[], global: GlobalOptions): ParsedArgs {
  let pipelineName: string | undefined;
  let from: string | undefined;
  let cont = false;
  let dryRun = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === '--from' && i + 1 < args.length) {
      from = args[++i]!;
    } else if (arg === '--continue') {
      cont = true;
    } else if (arg === '--dry-run') {
      dryRun = true;
    } else if (!arg.startsWith('-') && !pipelineName) {
      pipelineName = arg;
    }
  }

  if (!pipelineName) {
    throw new Error(
      'pipeline run command requires a pipeline name. Usage: gfos-build pipeline run <name> [options]',
    );
  }

  return { command: { name: 'pipeline:run', pipelineName, from, continue: cont, dryRun }, global };
}

function parseScan(args: string[], global: GlobalOptions): ParsedArgs {
  let pathArg: string | undefined;
  let noCache = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === '--no-cache') {
      noCache = true;
    } else if (arg === '--depth' && i + 1 < args.length) {
      i += 1;
    } else if (!arg.startsWith('-') && !pathArg) {
      pathArg = arg;
    }
  }

  return { command: { name: 'scan', path: pathArg, noCache }, global };
}

function parseServe(args: string[], global: GlobalOptions): ParsedArgs {
  let port = 0;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === '--port' && i + 1 < args.length) {
      port = parseInt(args[++i]!, 10);
    }
  }
  return { command: { name: 'serve', port }, global };
}
