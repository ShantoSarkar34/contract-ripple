import { expect } from "vitest";
import { EngineError, type EngineErrorCode } from "../errors.js";

export function expectEngineError(fn: () => unknown, code: EngineErrorCode): EngineError {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(EngineError);
    const engineError = error as EngineError;
    expect(engineError.code).toBe(code);
    return engineError;
  }
  throw new Error(`Expected EngineError with code ${code}`);
}

export async function expectEngineErrorAsync(
  promise: Promise<unknown>,
  code: EngineErrorCode,
): Promise<EngineError> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(EngineError);
    const engineError = error as EngineError;
    expect(engineError.code).toBe(code);
    return engineError;
  }
  throw new Error(`Expected EngineError with code ${code}`);
}
