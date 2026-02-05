/**
 * Mock data for GFOS-Build redesign demos
 */

export interface Project {
  id: string;
  name: string;
  path: string;
  branch: string;
  lastBuild?: {
    status: 'success' | 'failed' | 'running' | 'pending';
    duration: string;
    timestamp: string;
  };
  jdk: string;
}

export interface JDK {
  id: string;
  version: string;
  vendor: string;
  path: string;
  isDefault?: boolean;
}

export interface BuildJob {
  id: string;
  projectName: string;
  status: 'success' | 'failed' | 'running' | 'pending';
  progress: number;
  startTime: string;
  duration?: string;
  jdk: string;
  goals: string;
}

export const projects: Project[] = [
  { id: '1', name: 'gfosweb', path: 'C:\\dev\\quellen\\2025\\gfosweb', branch: 'main', lastBuild: { status: 'success', duration: '2m 34s', timestamp: '10 min ago' }, jdk: 'JDK 21' },
  { id: '2', name: 'gfoshg', path: 'C:\\dev\\quellen\\2025\\gfoshg', branch: 'develop', lastBuild: { status: 'running', duration: '1m 12s', timestamp: 'now' }, jdk: 'JDK 17' },
  { id: '3', name: 'gfosdashboard', path: 'C:\\dev\\quellen\\2025\\gfosdashboard', branch: 'feature/auth', lastBuild: { status: 'failed', duration: '45s', timestamp: '1h ago' }, jdk: 'JDK 21' },
  { id: '4', name: 'gfosshared', path: 'C:\\dev\\quellen\\2025\\gfosshared', branch: 'main', lastBuild: { status: 'success', duration: '1m 58s', timestamp: '2h ago' }, jdk: 'JDK 17' },
  { id: '5', name: 'gfosweb_2', path: 'C:\\dev\\quellen\\2025\\gfosweb_2', branch: 'release/4.9', jdk: 'JDK 11' },
  { id: '6', name: 'delphi', path: 'C:\\dev\\quellen\\2025\\delphi', branch: 'main', lastBuild: { status: 'success', duration: '3m 12s', timestamp: '3h ago' }, jdk: 'JDK 21' },
];

export const jdks: JDK[] = [
  { id: '1', version: '21.0.2', vendor: 'Eclipse Temurin', path: 'C:\\dev\\java\\jdk21', isDefault: true },
  { id: '2', version: '17.0.10', vendor: 'Eclipse Temurin', path: 'C:\\dev\\java\\jdk17' },
  { id: '3', version: '11.0.27', vendor: 'OpenJDK', path: 'C:\\dev\\java\\jdk11' },
  { id: '4', version: '8u402', vendor: 'Amazon Corretto', path: 'C:\\dev\\java\\jdk8' },
];

export const buildJobs: BuildJob[] = [
  { id: '1', projectName: 'gfoshg', status: 'running', progress: 67, startTime: '14:32', jdk: 'JDK 17', goals: 'clean install' },
  { id: '2', projectName: 'gfosweb', status: 'pending', progress: 0, startTime: 'Queued', jdk: 'JDK 21', goals: 'clean package -DskipTests' },
  { id: '3', projectName: 'gfosdashboard', status: 'failed', progress: 100, startTime: '14:15', duration: '45s', jdk: 'JDK 21', goals: 'clean install' },
  { id: '4', projectName: 'gfosshared', status: 'success', progress: 100, startTime: '13:45', duration: '1m 58s', jdk: 'JDK 17', goals: 'clean install -Pproduction' },
  { id: '5', projectName: 'delphi', status: 'success', progress: 100, startTime: '13:20', duration: '3m 12s', jdk: 'JDK 21', goals: 'clean install' },
];

export const stats = {
  totalProjects: 15,
  mavenProjects: 12,
  activeBuilds: 1,
  queuedBuilds: 1,
  successfulBuilds: 47,
  failedBuilds: 3,
  jdkCount: 4,
};
