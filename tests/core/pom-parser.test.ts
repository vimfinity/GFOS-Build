import { describe, it, expect } from 'vitest';
import { parsePom } from '../../packages/domain/src/pom-parser.js';

describe('parsePom', () => {
  it('extracts artifactId', () => {
    const content = `<project>
      <artifactId>my-artifact</artifactId>
    </project>`;
    expect(parsePom(content).artifactId).toBe('my-artifact');
  });

  it('defaults artifactId to "unknown" when missing', () => {
    expect(parsePom('<project></project>').artifactId).toBe('unknown');
  });

  it('extracts packaging', () => {
    const content = `<project>
      <artifactId>ear-pkg</artifactId>
      <packaging>ear</packaging>
    </project>`;
    expect(parsePom(content).packaging).toBe('ear');
  });

  it('defaults packaging to jar when missing', () => {
    const content = `<project><artifactId>foo</artifactId></project>`;
    expect(parsePom(content).packaging).toBe('jar');
  });

  it('detects aggregator when <modules> section present', () => {
    const content = `<project>
      <artifactId>parent</artifactId>
      <packaging>pom</packaging>
      <modules>
        <module>child-a</module>
      </modules>
    </project>`;
    expect(parsePom(content).isAggregator).toBe(true);
  });

  it('marks non-aggregator when no <modules>', () => {
    const content = `<project><artifactId>leaf</artifactId></project>`;
    expect(parsePom(content).isAggregator).toBe(false);
  });

  it('extracts javaVersion from maven.compiler.release', () => {
    const content = `<project>
      <artifactId>foo</artifactId>
      <properties>
        <maven.compiler.release>21</maven.compiler.release>
      </properties>
    </project>`;
    expect(parsePom(content).javaVersion).toBe('21');
  });

  it('extracts javaVersion from maven.compiler.source', () => {
    const content = `<project>
      <artifactId>foo</artifactId>
      <properties>
        <maven.compiler.source>17</maven.compiler.source>
      </properties>
    </project>`;
    expect(parsePom(content).javaVersion).toBe('17');
  });

  it('prefers maven.compiler.source over maven.compiler.release', () => {
    const content = `<project>
      <artifactId>foo</artifactId>
      <properties>
        <maven.compiler.release>21</maven.compiler.release>
        <maven.compiler.source>17</maven.compiler.source>
      </properties>
    </project>`;
    expect(parsePom(content).javaVersion).toBe('17');
  });

  it('returns undefined javaVersion when no compiler properties', () => {
    const content = `<project><artifactId>foo</artifactId></project>`;
    expect(parsePom(content).javaVersion).toBeUndefined();
  });

  it('extracts version, build directory, and finalName', () => {
    const content = `<project>
      <artifactId>deployable-app</artifactId>
      <version>1.2.3</version>
      <build>
        <directory>custom-target</directory>
        <finalName>deployable-custom</finalName>
      </build>
    </project>`;
    const result = parsePom(content);
    expect(result.version).toBe('1.2.3');
    expect(result.buildDirectory).toBe('custom-target');
    expect(result.finalName).toBe('deployable-custom');
  });

  it('parses a full realistic pom.xml', () => {
    const content = `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
  <modelVersion>4.0.0</modelVersion>
  <groupId>com.gfos</groupId>
  <artifactId>shared</artifactId>
  <version>2025.0.0</version>
  <packaging>pom</packaging>
  <modules>
    <module>shared-core</module>
    <module>shared-api</module>
  </modules>
  <properties>
    <maven.compiler.release>21</maven.compiler.release>
  </properties>
</project>`;
    const result = parsePom(content);
    expect(result.artifactId).toBe('shared');
    expect(result.packaging).toBe('pom');
    expect(result.isAggregator).toBe(true);
    expect(result.javaVersion).toBe('21');
  });
});
