import Redis from 'ioredis';

export class DistributedLock {
  private redis: Redis;
  private lockKey: string;
  private lockValue: string | null = null;
  private ttl: number;

  constructor(redis: Redis, resource: string, ttl: number = 30000) {
    this.redis = redis;
    this.lockKey = `lock:${resource}`;
    this.ttl = ttl;
    this.lockValue = this.generateLockValue();
  }

  private generateLockValue(): string {
    return `${Date.now()}:${Math.random().toString(36).substring(2)}`;
  }

  async acquire(): Promise<boolean> {
    if (!this.lockValue) {
      this.lockValue = this.generateLockValue();
    }
    
    const result = await this.redis.set(
      this.lockKey,
      this.lockValue,
      'PX',
      this.ttl,
      'NX'
    );

    return result === 'OK';
  }

  async release(): Promise<boolean> {
    if (!this.lockValue) return false;

    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;

    const result = await this.redis.eval(script, 1, this.lockKey, this.lockValue);
    this.lockValue = null;
    
    return result === 1;
  }

  async acquireWithRetry(maxRetries: number = 5, retryDelay: number = 100): Promise<boolean> {
    for (let i = 0; i < maxRetries; i++) {
      const acquired = await this.acquire();
      if (acquired) return true;
      
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
    return false;
  }
}

export async function withLock<T>(
  redis: Redis,
  resource: string,
  fn: () => Promise<T>,
  ttl: number = 30000
): Promise<T> {
  const lock = new DistributedLock(redis, resource, ttl);
  const acquired = await lock.acquireWithRetry();
  
  if (!acquired) {
    throw new Error('Failed to acquire lock');
  }

  try {
    return await fn();
  } finally {
    await lock.release();
  }
}
