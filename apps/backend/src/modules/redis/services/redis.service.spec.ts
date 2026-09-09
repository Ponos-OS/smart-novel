import { RedisService } from './redis.service';

const mockClient = {
  on: vi.fn(),
  quit: vi.fn(),
  get: vi.fn(),
  set: vi.fn(),
  setex: vi.fn(),
  del: vi.fn(),
  ping: vi.fn(),
  eval: vi.fn(),
  sendCommand: vi.fn(),
  publish: vi.fn(),
};

vi.mock('ioredis', () => {
  const Redis = vi.fn(function () {
    return mockClient;
  });
  const Command = vi.fn(function (
    this: any,
    name: string,
    args: any[],
  ) {
    this.name = name;
    this.args = args;
  });
  return { Redis, Command };
});

describe(RedisService.name, () => {
  let uut: RedisService;

  beforeEach(() => {
    vi.clearAllMocks();
    const logger = {
      log: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
      verbose: vi.fn(),
    } as any;

    uut = new RedisService(
      {
        redisUrl: 'redis://localhost:6379',
        redisPassword: 'password',
      },
      logger,
    );
  });

  it('should set a value', async () => {
    await uut.set('key', 'value');

    expect(mockClient.set).toHaveBeenCalledWith('key', 'value');
    expect(mockClient.setex).not.toHaveBeenCalled();
  });

  it('should set a value with TTL', async () => {
    await uut.set('key', 'value', 60);

    expect(mockClient.setex).toHaveBeenCalledWith('key', 60, 'value');
    expect(mockClient.set).not.toHaveBeenCalled();
  });

  it('should set a value with NX option', async () => {
    mockClient.sendCommand.mockResolvedValue(Buffer.from('OK'));

    await uut.set('key', 'value', { nx: true });

    expect(mockClient.set).not.toHaveBeenCalled();
    expect(mockClient.setex).not.toHaveBeenCalled();
    expect(mockClient.sendCommand).toHaveBeenCalledTimes(1);
    const commandArg = mockClient.sendCommand.mock.calls[0][0];
    expect(commandArg.name).toBe('SET');
    expect(commandArg.args).toEqual(['key', 'value', 'NX']);
  });

  it('should get a value', async () => {
    mockClient.get.mockResolvedValue('value');

    const result = await uut.get('key');

    expect(mockClient.get).toHaveBeenCalledWith('key');
    expect(result).toBe('value');
  });

  it('should return true when it finds the key to delete', async () => {
    mockClient.del.mockResolvedValue(1);

    const result = await uut.del('key');

    expect(mockClient.del).toHaveBeenCalledWith('key');
    expect(result).toBeTrue();
  });

  it('should return true when it finds the key to delete', async () => {
    mockClient.del.mockResolvedValue(0);

    const result = await uut.del('key');

    expect(mockClient.del).toHaveBeenCalledWith('key');
    expect(result).toBeFalse();
  });

  it('should publish a message on a channel and return the subscriber count', async () => {
    mockClient.publish.mockResolvedValue(2);

    const result = await uut.publish('tts-audio:status', '{"a":1}');

    expect(mockClient.publish).toHaveBeenCalledWith(
      'tts-audio:status',
      '{"a":1}',
    );
    expect(result).toBe(2);
  });

  it('should evaluate and execute a Lua script server side', () => {
    const luaScript = 'return redis.call("DEL", KEYS[1])';

    uut.evaluate(luaScript, 1, 'key', 'token');

    expect(mockClient.eval).toHaveBeenCalledWith(
      luaScript,
      1,
      'key',
      'token',
    );
  });

  it('should close connection on module destroy', async () => {
    await uut.onModuleDestroy();

    expect(mockClient.quit).toHaveBeenCalled();
  });
});
