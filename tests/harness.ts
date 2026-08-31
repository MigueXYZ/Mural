/**
 * Mural (OrdemTools) - Lightweight Test Harness & Assertion Engine
 * Zero-dependency, ultra-fast test framework supporting async tests,
 * suite grouping, lifecycle hooks, fluent assertions, and structured reporting.
 */

export interface TestCase {
  name: string;
  fn: () => void | Promise<void>;
  passed?: boolean;
  error?: Error | any;
  durationMs?: number;
}

export interface TestSuite {
  name: string;
  tests: TestCase[];
  beforeEachHooks: Array<() => void | Promise<void>>;
  afterEachHooks: Array<() => void | Promise<void>>;
}

export interface TestRunResult {
  total: number;
  passed: number;
  failed: number;
  durationMs: number;
  suites: Array<{
    name: string;
    passed: number;
    failed: number;
    durationMs: number;
    tests: TestCase[];
  }>;
}

class TestRegistry {
  suites: TestSuite[] = [];
  currentSuite: TestSuite | null = null;

  getOrCreateSuite(name: string): TestSuite {
    let suite = this.suites.find((s) => s.name === name);
    if (!suite) {
      suite = {
        name,
        tests: [],
        beforeEachHooks: [],
        afterEachHooks: [],
      };
      this.suites.push(suite);
    }
    return suite;
  }
}

const registry = new TestRegistry();

export function describe(name: string, fn: () => void) {
  const previousSuite = registry.currentSuite;
  const suite = registry.getOrCreateSuite(name);
  registry.currentSuite = suite;
  try {
    fn();
  } finally {
    registry.currentSuite = previousSuite;
  }
}

export function test(name: string, fn: () => void | Promise<void>) {
  let targetSuite = registry.currentSuite;
  if (!targetSuite) {
    targetSuite = registry.getOrCreateSuite('Default Suite');
  }
  targetSuite.tests.push({
    name,
    fn,
  });
}

export const it = test;

export function beforeEach(fn: () => void | Promise<void>) {
  if (registry.currentSuite) {
    registry.currentSuite.beforeEachHooks.push(fn);
  }
}

export function afterEach(fn: () => void | Promise<void>) {
  if (registry.currentSuite) {
    registry.currentSuite.afterEachHooks.push(fn);
  }
}

// ============================================================================
// Assertion Library (expect)
// ============================================================================

function deepEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') {
    return false;
  }
  if (Array.isArray(a) !== Array.isArray(b)) return false;

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
    if (!deepEqual(a[key], b[key])) return false;
  }
  return true;
}

export class Matcher {
  private actual: any;
  private isNot: boolean;

  constructor(actual: any, isNot = false) {
    this.actual = actual;
    this.isNot = isNot;
  }

  get not(): Matcher {
    return new Matcher(this.actual, !this.isNot);
  }

  private assert(condition: boolean, message: string) {
    const passed = this.isNot ? !condition : condition;
    if (!passed) {
      throw new Error(message);
    }
  }

  toBe(expected: any) {
    this.assert(
      Object.is(this.actual, expected),
      `Expected ${JSON.stringify(this.actual)} ${this.isNot ? 'NOT ' : ''}to be ${JSON.stringify(expected)}`
    );
  }

  toEqual(expected: any) {
    this.assert(
      deepEqual(this.actual, expected),
      `Expected ${JSON.stringify(this.actual)} ${this.isNot ? 'NOT ' : ''}to equal ${JSON.stringify(expected)}`
    );
  }

  toBeDefined() {
    this.assert(
      this.actual !== undefined,
      `Expected value ${this.isNot ? 'NOT ' : ''}to be defined, but received undefined`
    );
  }

  toBeUndefined() {
    this.assert(
      this.actual === undefined,
      `Expected ${JSON.stringify(this.actual)} ${this.isNot ? 'NOT ' : ''}to be undefined`
    );
  }

  toBeNull() {
    this.assert(
      this.actual === null,
      `Expected ${JSON.stringify(this.actual)} ${this.isNot ? 'NOT ' : ''}to be null`
    );
  }

  toBeTruthy() {
    this.assert(
      Boolean(this.actual),
      `Expected ${JSON.stringify(this.actual)} ${this.isNot ? 'NOT ' : ''}to be truthy`
    );
  }

  toBeFalsy() {
    this.assert(
      !Boolean(this.actual),
      `Expected ${JSON.stringify(this.actual)} ${this.isNot ? 'NOT ' : ''}to be falsy`
    );
  }

  toBeGreaterThan(expected: number) {
    this.assert(
      this.actual > expected,
      `Expected ${this.actual} ${this.isNot ? 'NOT ' : ''}to be greater than ${expected}`
    );
  }

  toBeGreaterThanOrEqual(expected: number) {
    this.assert(
      this.actual >= expected,
      `Expected ${this.actual} ${this.isNot ? 'NOT ' : ''}to be greater than or equal to ${expected}`
    );
  }

  toBeLessThan(expected: number) {
    this.assert(
      this.actual < expected,
      `Expected ${this.actual} ${this.isNot ? 'NOT ' : ''}to be less than ${expected}`
    );
  }

  toBeLessThanOrEqual(expected: number) {
    this.assert(
      this.actual <= expected,
      `Expected ${this.actual} ${this.isNot ? 'NOT ' : ''}to be less than or equal to ${expected}`
    );
  }

  toContain(expected: any) {
    if (typeof this.actual === 'string') {
      this.assert(
        this.actual.includes(String(expected)),
        `Expected string "${this.actual}" ${this.isNot ? 'NOT ' : ''}to contain "${expected}"`
      );
    } else if (Array.isArray(this.actual)) {
      const contains = this.actual.some((item) => deepEqual(item, expected) || item === expected);
      this.assert(
        contains,
        `Expected array ${JSON.stringify(this.actual)} ${this.isNot ? 'NOT ' : ''}to contain ${JSON.stringify(expected)}`
      );
    } else {
      throw new Error(`toContain can only be used on strings or arrays, got ${typeof this.actual}`);
    }
  }

  toHaveLength(expected: number) {
    const length = this.actual?.length;
    this.assert(
      length === expected,
      `Expected object with length ${expected}, but got length ${length}`
    );
  }

  toMatch(pattern: RegExp | string) {
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
    this.assert(
      regex.test(String(this.actual)),
      `Expected "${this.actual}" ${this.isNot ? 'NOT ' : ''}to match ${pattern}`
    );
  }

  toBeCloseTo(expected: number, numDigits = 2) {
    const diff = Math.abs(this.actual - expected);
    const tolerance = Math.pow(10, -numDigits) / 2;
    this.assert(
      diff < tolerance,
      `Expected ${this.actual} ${this.isNot ? 'NOT ' : ''}to be close to ${expected} (within ${tolerance})`
    );
  }

  toThrow(expectedMessageOrRegex?: string | RegExp) {
    if (typeof this.actual !== 'function') {
      throw new Error('toThrow requires a function');
    }
    let error: any = null;
    try {
      this.actual();
    } catch (e) {
      error = e;
    }

    if (this.isNot) {
      if (error) {
        throw new Error(`Expected function NOT to throw, but it threw: ${error.message || error}`);
      }
    } else {
      if (!error) {
        throw new Error('Expected function to throw an error, but it did not throw.');
      }
      if (expectedMessageOrRegex) {
        const errorMsg = error.message || String(error);
        if (typeof expectedMessageOrRegex === 'string') {
          if (!errorMsg.includes(expectedMessageOrRegex)) {
            throw new Error(`Expected error message to include "${expectedMessageOrRegex}", but got "${errorMsg}"`);
          }
        } else if (!expectedMessageOrRegex.test(errorMsg)) {
          throw new Error(`Expected error message to match ${expectedMessageOrRegex}, but got "${errorMsg}"`);
        }
      }
    }
  }
}

export function expect(actual: any): Matcher {
  return new Matcher(actual);
}

// ============================================================================
// Runner Engine
// ============================================================================

export async function runSuites(filterSuiteName?: string): Promise<TestRunResult> {
  const startTime = Date.now();
  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;

  const resultSuites: TestRunResult['suites'] = [];

  const suitesToRun = filterSuiteName
    ? registry.suites.filter((s) => s.name === filterSuiteName)
    : registry.suites;

  for (const suite of suitesToRun) {
    const suiteStart = Date.now();
    let suitePassed = 0;
    let suiteFailed = 0;

    for (const testCase of suite.tests) {
      totalTests++;
      const testStart = Date.now();

      // Run beforeEach hooks
      for (const hook of suite.beforeEachHooks) {
        try {
          await hook();
        } catch (e) {
          testCase.passed = false;
          testCase.error = new Error(`beforeEach hook failed: ${(e as Error).message}`);
          suiteFailed++;
          failedTests++;
          continue;
        }
      }

      try {
        await testCase.fn();
        testCase.passed = true;
        suitePassed++;
        passedTests++;
      } catch (err: any) {
        testCase.passed = false;
        testCase.error = err;
        suiteFailed++;
        failedTests++;
      } finally {
        testCase.durationMs = Date.now() - testStart;
        // Run afterEach hooks
        for (const hook of suite.afterEachHooks) {
          try {
            await hook();
          } catch (e) {
            console.error(`afterEach hook error: ${(e as Error).message}`);
          }
        }
      }
    }

    resultSuites.push({
      name: suite.name,
      passed: suitePassed,
      failed: suiteFailed,
      durationMs: Date.now() - suiteStart,
      tests: suite.tests,
    });
  }

  return {
    total: totalTests,
    passed: passedTests,
    failed: failedTests,
    durationMs: Date.now() - startTime,
    suites: resultSuites,
  };
}

export function clearSuites() {
  registry.suites = [];
  registry.currentSuite = null;
}
