import * as readline from 'node:readline/promises';
import { getConfigPath, saveSettings } from '@gfos-build/platform-node';

const EXAMPLE_CONFIG = (rootPath: string, jdkBasePath: string) =>
  JSON.stringify(
    {
      roots: {
        quellen: rootPath || 'J:/dev/quellen',
      },
      maven: {
        executable: 'mvn',
        defaultGoals: ['clean', 'install'],
        defaultOptionKeys: [],
        defaultExtraOptions: [],
      },
      node: {
        executables: {
          npm: 'npm',
          pnpm: 'pnpm',
          bun: 'bun',
        },
      },
      jdkRegistry: jdkBasePath
        ? {
            '8': `${jdkBasePath}/jdk8`,
            '11': `${jdkBasePath}/jdk11`,
            '17': `${jdkBasePath}/jdk17`,
            '21': `${jdkBasePath}/jdk21`,
          }
        : {},
      scan: {
        includeHidden: false,
        exclude: [],
      },
    },
    null,
    2,
  );

export async function runConfigInit(): Promise<void> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  console.log('\ngfos-build configuration wizard\n');

  const rootPath = (await rl.question('Path to your repositories root (e.g. J:/dev/quellen): ')).trim();
  const jdkBasePath = (await rl.question('Path to your JDK installations (e.g. J:/dev/java, empty to skip): ')).trim();

  rl.close();

  const configPath = getConfigPath();
  const content = EXAMPLE_CONFIG(rootPath, jdkBasePath);
  saveSettings(JSON.parse(content), configPath);

  console.log(`\nConfig written to: ${configPath}`);
  console.log('Edit it to add pipelines and adjust settings.');
}
