import { describe, expect, it } from 'vitest';
import { buildWindowsExternalLaunchCommand } from '../../src/infrastructure/process-runner.js';

describe('buildWindowsExternalLaunchCommand', () => {
  it('prefers a PowerShell terminal instead of cmd.exe', () => {
    const command = buildWindowsExternalLaunchCommand('npm', ['run', 'dev'], 'C:/repo/app');

    expect(command).toContain("Get-Command pwsh.exe");
    expect(command).toContain("Start-Process -FilePath $shell");
    expect(command).toContain("'-NoExit'");
    expect(command).toContain("Set-Location -LiteralPath ''C:/repo/app''");
    expect(command).toContain("& ''npm'' ''run'' ''dev''");
    expect(command).not.toContain('cmd.exe');
  });
});
