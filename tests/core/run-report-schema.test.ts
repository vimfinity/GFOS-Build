import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { runCommand } from '../../src/application/orchestrator.js';
import { BuildOptions, MavenRepository, ModuleGraph } from '../../src/core/types.js';

function validateSchema(schema: unknown, value: unknown, pointer = '$'): string[] {
  const schemaObj = (schema ?? {}) as Record<string, unknown>;
  const errors: string[] = [];

  if (schemaObj.const !== undefined && value !== schemaObj.const) {
    errors.push(`${pointer}: expected const ${String(schemaObj.const)}`);
    return errors;
  }

  if (Array.isArray(schemaObj.enum) && !schemaObj.enum.includes(value)) {
    errors.push(`${pointer}: expected one of ${schemaObj.enum.join(', ')}`);
    return errors;
  }

  if (schemaObj.type === 'object') {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      errors.push(`${pointer}: expected object`);
      return errors;
    }

    const objectValue = value as Record<string, unknown>;
    const required = (schemaObj.required ?? []) as string[];
    for (const key of required) {
      if (!(key in objectValue)) {
        errors.push(`${pointer}.${key}: missing required property`);
      }
    }

    const properties = (schemaObj.properties ?? {}) as Record<string, unknown>;
    for (const [key, nestedSchema] of Object.entries(properties)) {
      if (key in objectValue) {
        errors.push(...validateSchema(nestedSchema, objectValue[key], `${pointer}.${key}`));
      }
    }

    if (schemaObj.additionalProperties === false) {
      for (const key of Object.keys(objectValue)) {
        if (!(key in properties)) {
          errors.push(`${pointer}.${key}: additional property is not allowed`);
        }
      }
    }

    return errors;
  }

  if (schemaObj.type === 'array') {
    if (!Array.isArray(value)) {
      errors.push(`${pointer}: expected array`);
      return errors;
    }

    if (typeof schemaObj.minItems === 'number' && value.length < schemaObj.minItems) {
      errors.push(`${pointer}: expected at least ${schemaObj.minItems} item(s)`);
    }

    if (schemaObj.items) {
      value.forEach((entry, index) => {
        errors.push(...validateSchema(schemaObj.items, entry, `${pointer}[${index}]`));
      });
    }

    return errors;
  }

  if (schemaObj.type === 'number') {
    if (typeof value !== 'number') {
      errors.push(`${pointer}: expected number`);
      return errors;
    }

    if (typeof schemaObj.minimum === 'number' && value < schemaObj.minimum) {
      errors.push(`${pointer}: expected >= ${schemaObj.minimum}`);
    }

    return errors;
  }

  if (schemaObj.type === 'string') {
    if (typeof value !== 'string') {
      errors.push(`${pointer}: expected string`);
      return errors;
    }

    if (typeof schemaObj.minLength === 'number' && value.length < schemaObj.minLength) {
      errors.push(`${pointer}: expected minLength ${schemaObj.minLength}`);
    }

    return errors;
  }

  if (schemaObj.type === 'boolean' && typeof value !== 'boolean') {
    errors.push(`${pointer}: expected boolean`);
  }

  return errors;
}

const repositories: MavenRepository[] = [
  { name: 'shared', path: '/repos/shared', pomPath: '/repos/shared/pom.xml', depth: 1 },
  { name: 'web', path: '/repos/web', pomPath: '/repos/web/pom.xml', depth: 1 },
];

const graph: ModuleGraph = {
  modules: repositories,
  rootModules: repositories,
};

function createScanner() {
  return {
    scanGraph: async () => graph,
    scanProfiles: async () => [],
  };
}

function createBuildService() {
  return {
    buildRepository: async (repository: MavenRepository, options: BuildOptions) => ({
      repository,
      exitCode: 0,
      durationMs: 5,
      mavenExecutable: options.mavenExecutable,
      javaHome: options.javaHome,
    }),
  };
}

function createCache() {
  return {
    createKey: (input: { roots: string[]; maxDepth: number; includeHidden: boolean }) => JSON.stringify(input),
    read: async () => null,
    write: async () => {},
  };
}

describe('run-report schema contract', () => {
  it('validates build-plan report against v1.1 schema', async () => {
    const schemaPath = path.resolve('assets/contracts/run-report.v1.1.schema.json');
    const schema = JSON.parse(readFileSync(schemaPath, 'utf-8')) as Record<string, unknown>;

    const report = await runCommand(
      {
        command: 'build',
        roots: ['/repos'],
        buildScope: 'root-only',
        planOnly: true,
        goals: ['clean', 'verify'],
        mavenExecutable: 'mvn',
        explainSelection: true,
      },
      createScanner() as never,
      createBuildService() as never,
      createCache() as never
    );

    const errors = validateSchema(schema, report);
    expect(errors).toEqual([]);
    expect(report.selectionExplanation?.length).toBeGreaterThan(0);
  });
});
