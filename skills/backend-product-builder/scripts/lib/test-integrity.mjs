// Counts assertion syntax; this is a structural guard, not semantic equivalence proof.
export function assertionCount(line) {
  return [...line.matchAll(/\b(?:(?:debug_)?assert(?:_eq|_ne)?!\s*\(|assert(?:\.|\s|\()|expect\s*\(|require\.\w+\s*\(|assert_\w+\s*\(|t\.(?:Error|Errorf|Fatal|Fatalf)\s*\()/g)].length;
}
