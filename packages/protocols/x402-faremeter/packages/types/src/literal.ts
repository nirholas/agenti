import { type } from "arktype";

/**
 * Creates an arktype validator for case-insensitive string literals.
 *
 * Input strings are lowercased before matching against the allowed values.
 *
 * @param l - The literal string values to accept (case-insensitive)
 * @returns An arktype validator that accepts any case variant of the literals
 */
export function caseInsensitiveLiteral<T extends string>(...l: T[]) {
  return type("string.lower").to(
    type.enumerated(...l.map((s) => s.toLowerCase())) as type.cast<
      Lowercase<T>
    >,
  );
}
