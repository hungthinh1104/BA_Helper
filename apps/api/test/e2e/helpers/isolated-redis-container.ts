import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';

const REDIS_IMAGE = 'redis:7-alpine';

export class IsolatedRedisContainer {
  private hostPort: number;

  private constructor(
    private readonly name: string,
    hostPort: number,
  ) {
    this.hostPort = hostPort;
  }

  static async start(): Promise<IsolatedRedisContainer> {
    const name = `ba-helper-e2e-redis-${process.pid}-${randomBytes(4).toString('hex')}`;
    execFileSync('docker', [
      'run', '--detach', '--name', name, '--label', 'ba-helper-e2e=redis-outage',
      '--publish', '127.0.0.1::6379', REDIS_IMAGE,
    ], { encoding: 'utf8', stdio: 'pipe', timeout: 120_000 });

    try {
      const portOutput = execFileSync('docker', ['port', name, '6379/tcp'], {
        encoding: 'utf8', stdio: 'pipe', timeout: 10_000,
      }).trim();
      const portMatch = portOutput.match(/127\.0\.0\.1:(\d+)/);
      if (!portMatch) throw new Error('Docker did not expose the isolated Redis port on loopback.');
      const container = new IsolatedRedisContainer(name, Number(portMatch[1]));
      await container.waitUntilReady();
      return container;
    } catch (error) {
      execFileSync('docker', ['rm', '--force', name], { stdio: 'ignore', timeout: 10_000 });
      throw error;
    }
  }

  url(database: number): string {
    return `redis://127.0.0.1:${this.hostPort}/${database}`;
  }

  isRunning(): boolean {
    return this.docker('inspect', '--format', '{{.State.Running}}', this.name) === 'true';
  }

  runId(): string {
    const info = this.docker('exec', this.name, 'redis-cli', 'INFO', 'server');
    const runId = info.match(/^run_id:([^\r\n]+)/m)?.[1];
    if (!runId) throw new Error('Isolated Redis did not return its server run ID.');
    return runId;
  }

  stop(): void {
    execFileSync('docker', ['stop', '--time', '2', this.name], {
      encoding: 'utf8', stdio: 'pipe', timeout: 10_000,
    });
  }

  async restart(): Promise<void> {
    execFileSync('docker', ['start', this.name], {
      encoding: 'utf8', stdio: 'pipe', timeout: 10_000,
    });
    this.hostPort = this.readHostPort();
    await this.waitUntilReady();
  }

  remove(): void {
    execFileSync('docker', ['rm', '--force', this.name], {
      encoding: 'utf8', stdio: 'pipe', timeout: 10_000,
    });
  }

  private async waitUntilReady(): Promise<void> {
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline) {
      try {
        if (this.isRunning()) {
          this.runId();
          return;
        }
      } catch { /* Retry until Docker and Redis both report ready. */ }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error('Isolated Redis container did not become ready before the deadline.');
  }

  private readHostPort(): number {
    const output = this.docker('port', this.name, '6379/tcp');
    const match = output.match(/127\.0\.0\.1:(\d+)/);
    if (!match) throw new Error('Docker did not expose the isolated Redis port on loopback.');
    return Number(match[1]);
  }

  private docker(...args: string[]): string {
    return execFileSync('docker', args, {
      encoding: 'utf8', stdio: 'pipe', timeout: 10_000,
    }).trim();
  }
}
