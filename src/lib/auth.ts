// Pure comparison so it is unit-testable. Route handlers pass the env value in.
export function keyIsValid(expected: string | undefined, provided: string | null | undefined): boolean {
  if (!expected) return false; // never allow access if no key configured
  return provided === expected;
}
