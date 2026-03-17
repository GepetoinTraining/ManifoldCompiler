// ════════════════════════════════════════════════════════════
// THE GATE — The only hardcoded logic in the entire application
// ════════════════════════════════════════════════════════════

/**
 * Greatest Common Divisor — Euclid's algorithm (3rd century BC)
 * Input: two numbers. Output: their largest shared factor.
 * This is pure mathematics. It generates nothing.
 */
export function gcd(a, b) {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) { [a, b] = [b, a % b]; }
  return a;
}

/**
 * Prime factorization via trial division.
 * Input: a number. Output: array of its prime factors.
 * Example: factorize(30) → [2, 3, 5]
 */
/**
 * Primality test via trial division.
 * Input: a number. Output: true if prime.
 */
export function isPrime(n) {
  if (n < 2) return false;
  if (n < 4) return true;
  if (n % 2 === 0 || n % 3 === 0) return false;
  for (let i = 5; i * i <= n; i += 6) {
    if (n % i === 0 || n % (i + 2) === 0) return false;
  }
  return true;
}

/**
 * Prime factorization via trial division.
 * Input: a number. Output: array of its prime factors.
 * Example: factorize(30) → [2, 3, 5]
 */
export function factorize(n) {
  if (n < 2) return [n];
  const f = [];
  let t = Math.abs(Math.round(n));
  for (let d = 2; d * d <= t; d++) {
    while (t % d === 0) { f.push(d); t /= d; }
  }
  if (t > 1) f.push(t);
  return f;
}

/**
 * THE GATE — canAccept
 *
 * Decides if a prime-addressed barcode can enter the system.
 * Two paths through the gate:
 *   1. Direct: this exact number exists in the generated set
 *   2. GCD:    this number shares a factor with anything generated
 *
 * This function does NOT generate content.
 * This function does NOT modify state.
 * It only returns true or false.
 */
export function canAccept(prime, generated) {
  // Direct existence
  if (generated.has(prime)) return true;

  // GCD relation: shares a factor with anything in the set
  for (const existing of generated) {
    if (gcd(prime, existing) > 1) return true;
  }

  return false;
}

/**
 * φ — the golden ratio, computed from first principles.
 * Continued fraction convergence: x = 1 + 1/x, iterated 100 times.
 */
export const PHI = (() => {
  let x = 2;
  for (let i = 0; i < 100; i++) x = 1 + 1 / x;
  return x;
})();
