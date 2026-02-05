/**
 * BuildService - Maven build execution with progress tracking.
 */

import { spawn } from 'child_process';
import { BrowserWindow } from 'electron';
import * as path from 'path';
import { processService } from './process.service';
import { configService } from './config.service';
import type { BuildJob } from '../../shared/types';

class BuildService {
  async execute(job: BuildJob, window: BrowserWindow): Promise<void> {
    const settings = await configService.load();
    const mavenExe = this.getMavenExecutable(settings.defaultMavenHome);
    const args = this.buildArgs(job);
    const env = this.buildEnvironment(job);

    const childProcess = spawn(mavenExe, args, {
      cwd: job.projectPath,
      env,
      shell: true,
    });

    processService.register(job.id, childProcess);

    childProcess.stdout?.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n');
      for (const line of lines) {
        if (line.trim()) {
          window.webContents.send('build:log', job.id, line);
          const progress = this.estimateProgress(line);
          if (progress !== null) {
            window.webContents.send('build:progress', job.id, progress);
          }
        }
      }
    });

    childProcess.stderr?.on('data', (data: Buffer) => {
      const lines = data.toString().split('\n');
      for (const line of lines) {
        if (line.trim()) {
          window.webContents.send('build:log', job.id, `[ERROR] ${line}`);
        }
      }
    });

    childProcess.on('close', (code: number | null) => {
      processService.unregister(job.id);
      const status = code === 0 ? 'success' : 'failed';
      window.webContents.send('build:complete', job.id, status, code);
    });

    childProcess.on('error', (error: Error) => {
      processService.unregister(job.id);
      window.webContents.send('build:error', job.id, error.message);
    });
  }

  cancel(jobId: string): boolean {
    return processService.kill(jobId);
  }

  private getMavenExecutable(mavenHome: string): string {
    return process.platform === 'win32'
      ? path.join(mavenHome, 'bin', 'mvn.cmd')
      : path.join(mavenHome, 'bin', 'mvn');
  }

  private buildArgs(job: BuildJob): string[] {
    const args = [...job.mavenGoals];
    if (job.skipTests) args.push('-DskipTests');
    if (job.offline) args.push('-o');
    if (job.enableThreads && job.threads) args.push('-T', job.threads);
    if (job.profiles && job.profiles.length > 0)
      args.push('-P', job.profiles.join(','));
    if (job.modulePath) args.push('-pl', job.modulePath, '-am');
    return args;
  }

  private buildEnvironment(job: BuildJob): NodeJS.ProcessEnv {
    return {
      ...process.env,
      JAVA_HOME: job.jdkPath,
      PATH: `${path.join(job.jdkPath, 'bin')}${path.delimiter}${process.env.PATH}`,
    };
  }

  private estimateProgress(logLine: string): number | null {
    if (logLine.includes('Scanning for projects')) return 5;
    if (logLine.includes('maven-clean-plugin')) return 10;
    if (logLine.includes('maven-resources-plugin')) return 20;
    if (logLine.includes('maven-compiler-plugin')) return 40;
    if (logLine.includes('maven-surefire-plugin')) return 60;
    if (logLine.includes('maven-jar-plugin')) return 75;
    if (logLine.includes('maven-install-plugin')) return 90;
    if (logLine.includes('BUILD SUCCESS')) return 100;
    if (logLine.includes('BUILD FAILURE')) return 100;
    return null;
  }
}

export const buildService = new BuildService();
