import { type } from "arktype";

/**
 * Type guard that checks if a value is an arktype validation error.
 *
 * @param possibleErrors - The value to check
 * @returns True if the value is a validation error
 */
export function isValidationError(
  possibleErrors: unknown,
): possibleErrors is type.errors {
  return possibleErrors instanceof type.errors;
}

/**
 * Throws an error with the validation error messages appended.
 *
 * @param message - Context message describing what was being validated
 * @param errors - The arktype validation errors
 * @throws Error with the message and error details
 */
export function throwValidationError(
  message: string,
  errors: type.errors,
): never {
  throw new Error(message + ": " + errors.map((e) => e.message).join(","));
}
