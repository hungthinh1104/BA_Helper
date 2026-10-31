import net from 'node:net';

type SocketPair = { client: net.Socket; upstream: net.Socket };

export class RedisTcpProxy {
  private readonly sockets = new Set<SocketPair>();
  private acceptedConnections = 0;
  private upstreamConnectionErrors = 0;
  private readonly server = net.createServer((client) => this.handleClient(client));

  private constructor(private target: URL) {}

  static async start(targetUrl: string): Promise<RedisTcpProxy> {
    const proxy = new RedisTcpProxy(new URL(targetUrl));
    await new Promise<void>((resolve, reject) => {
      proxy.server.once('error', reject);
      proxy.server.listen(0, '127.0.0.1', () => resolve());
    });
    return proxy;
  }

  get url(): string {
    const address = this.server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Redis TCP proxy is not listening.');
    }
    const url = new URL(this.target);
    url.hostname = '127.0.0.1';
    url.port = String(address.port);
    return url.toString();
  }

  setTarget(targetUrl: string): void {
    this.target = new URL(targetUrl);
  }

  get acceptedConnectionCount(): number {
    return this.acceptedConnections;
  }

  get activeConnectionCount(): number {
    return this.sockets.size;
  }

  get upstreamConnectionErrorCount(): number {
    return this.upstreamConnectionErrors;
  }

  async close(): Promise<void> {
    for (const pair of this.sockets) this.destroyPair(pair);
    if (this.server.listening) {
      await new Promise<void>((resolve) => this.server.close(() => resolve()));
    }
  }

  private handleClient(client: net.Socket): void {
    this.acceptedConnections += 1;
    const port = Number(this.target.port || (this.target.protocol === 'rediss:' ? 6380 : 6379));
    const upstream = net.createConnection({ host: this.target.hostname, port });
    const pair = { client, upstream };
    this.sockets.add(pair);
    client.on('error', () => this.destroyPair(pair));
    upstream.on('error', () => {
      this.upstreamConnectionErrors += 1;
      this.destroyPair(pair);
    });
    client.on('close', () => this.destroyPair(pair));
    upstream.on('close', () => this.destroyPair(pair));
    client.pipe(upstream);
    upstream.pipe(client);
  }

  private destroyPair(pair: SocketPair): void {
    this.sockets.delete(pair);
    if (!pair.client.destroyed) pair.client.destroy();
    if (!pair.upstream.destroyed) pair.upstream.destroy();
  }
}
