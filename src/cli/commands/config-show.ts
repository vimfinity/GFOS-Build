import type { AppConfig } from '../../config/schema.js';

export function runConfigShow(config: AppConfig, configPath: string): void {
  console.log(`Config loaded from: ${configPath}\n`);
  console.log(JSON.stringify(config, null, 2));
}
