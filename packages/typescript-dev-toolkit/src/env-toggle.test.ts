import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import {
  getDisabledScriptEnvVariableName,
  isEnvVariableOff,
  loadEnvFileIfExists
} from './env-toggle.ts';

const { mockExistsSync, mockLoadEnvFile } = vi.hoisted(() => ({
  mockExistsSync: vi.fn<(path: string) => boolean>(),
  mockLoadEnvFile: vi.fn()
}));

vi.mock('node:fs', async (importOriginal) => ({
  ...await importOriginal<typeof import('node:fs')>(),
  existsSync: mockExistsSync
}));

vi.mock('node:process', async (importOriginal) => {
  const $module = await importOriginal<typeof import('node:process')>();
  return {
    ...$module,
    default: {
      ...$module,
      loadEnvFile: mockLoadEnvFile
    }
  };
});

describe('isEnvVariableOff', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each(['0', 'false', 'no', 'off', 'OFF', 'False', ' no '])('should treat %j as off', (value) => {
    vi.stubEnv('SOME_SCRIPT', value);
    expect(isEnvVariableOff('SOME_SCRIPT')).toBe(true);
  });

  it.each(['1', 'true', 'yes', 'on', ''])('should treat %j as on', (value) => {
    vi.stubEnv('SOME_SCRIPT', value);
    expect(isEnvVariableOff('SOME_SCRIPT')).toBe(false);
  });

  it('should treat an unset variable as on', () => {
    vi.stubEnv('SOME_SCRIPT', undefined);
    expect(isEnvVariableOff('SOME_SCRIPT')).toBe(false);
  });
});

describe('loadEnvFileIfExists', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should load .env when it exists', () => {
    mockExistsSync.mockReturnValue(true);
    loadEnvFileIfExists();
    expect(mockLoadEnvFile).toHaveBeenCalledWith('.env');
  });

  it('should not load .env when it is absent', () => {
    mockExistsSync.mockReturnValue(false);
    loadEnvFileIfExists();
    expect(mockLoadEnvFile).not.toHaveBeenCalled();
  });
});

describe('getDisabledScriptEnvVariableName', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExistsSync.mockReturnValue(false);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each([
    ['lint', 'LINT'],
    ['lint:md', 'LINT_MD'],
    ['lint:md:fix', 'LINT_MD_FIX'],
    ['format:check', 'FORMAT_CHECK'],
    ['find-overexposed', 'FIND_OVEREXPOSED'],
    ['find-overexposed:fix', 'FIND_OVEREXPOSED_FIX']
  ])('should derive %j into %j and report it as disabled', (scriptName, envVariableName) => {
    vi.stubEnv('npm_lifecycle_event', scriptName);
    vi.stubEnv(envVariableName, '0');
    expect(getDisabledScriptEnvVariableName()).toBe(envVariableName);
  });

  it('should return null when the derived variable is not off', () => {
    vi.stubEnv('npm_lifecycle_event', 'lint:md');
    vi.stubEnv('LINT_MD', '1');
    expect(getDisabledScriptEnvVariableName()).toBeNull();
  });

  it('should return null when the derived variable is unset', () => {
    vi.stubEnv('npm_lifecycle_event', 'lint:md');
    vi.stubEnv('LINT_MD', undefined);
    expect(getDisabledScriptEnvVariableName()).toBeNull();
  });

  it('should return null when there is no npm script name', () => {
    vi.stubEnv('npm_lifecycle_event', undefined);
    expect(getDisabledScriptEnvVariableName()).toBeNull();
  });

  it('should load .env so the switch can be set persistently', () => {
    mockExistsSync.mockReturnValue(true);
    vi.stubEnv('npm_lifecycle_event', 'lint');
    getDisabledScriptEnvVariableName();
    expect(mockLoadEnvFile).toHaveBeenCalledWith('.env');
  });
});
