export interface PackageParsed {
  name: string;
  version?: string;
  scripts: Record<string, string>;
  isAngular: boolean;
  angularVersion?: string;
}

export function parsePackageJson(content: string): PackageParsed {
  let pkg: Record<string, unknown>;
  try {
    pkg = JSON.parse(content) as Record<string, unknown>;
  } catch {
    return { name: 'unknown', scripts: {}, isAngular: false };
  }

  const name = typeof pkg['name'] === 'string' ? pkg['name'] : 'unknown';
  const version = typeof pkg['version'] === 'string' ? pkg['version'] : undefined;

  const scripts: Record<string, string> = {};
  if (pkg['scripts'] && typeof pkg['scripts'] === 'object') {
    for (const [k, v] of Object.entries(pkg['scripts'] as Record<string, unknown>)) {
      if (typeof v === 'string') scripts[k] = v;
    }
  }

  const deps = {
    ...(pkg['dependencies'] as Record<string, string> | undefined),
    ...(pkg['devDependencies'] as Record<string, string> | undefined),
  };

  const isAngular = '@angular/core' in deps || '@angular/cli' in deps;
  const angularVersion = (deps['@angular/core'] ?? deps['@angular/cli'])?.replace(/[^0-9.]/g, '');

  return { name, version, scripts, isAngular, angularVersion };
}
