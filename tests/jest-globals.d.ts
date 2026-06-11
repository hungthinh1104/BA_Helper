declare function describe(name: string, fn: () => void): void;
declare function it(name: string, fn: () => void | Promise<void>): void;
declare function beforeEach(fn: () => void | Promise<void>): void;
declare function afterEach(fn: () => void | Promise<void>): void;

type Matchers = {
  toBe: (expected: unknown) => void;
  toEqual: (expected: unknown) => void;
  toMatchObject: (expected: unknown) => void;
  toThrow: (message?: string) => void;
  toHaveLength: (length: number) => void;
  toContain: (item: unknown) => void;
  toBeGreaterThan: (num: number) => void;
  toBeTruthy: () => void;
  toBeFalsy: () => void;
  toBeDefined: () => void;
  toBeNull: () => void;
  toBeUndefined: () => void;
  toMatchInlineSnapshot: (snapshot?: string) => void;
};

type ExpectReturn = Matchers & {
  not: Matchers;
  rejects: Matchers & { toMatchObject: (expected: unknown) => Promise<void> };
  resolves: Matchers;
};

declare function expect(value: unknown): ExpectReturn;
