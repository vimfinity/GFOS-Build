import type { AppConfig } from '@gfos-build/platform-node';

export function runConfigShow(config: AppConfig, configPath: string, json: boolean): void {
  if (json) {
    process.stdout.write(
      JSON.stringify(
        {
          source: configPath,
          config,
        },
        null,
        2,
      ) + '\n',
    );
    return;
  }

  console.log(`Config loaded from: ${configPath}\n`);
  console.log(JSON.stringify(config, null, 2));
}
