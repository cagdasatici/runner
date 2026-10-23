// One-to-one port of GameCore/Sources/GameCore/RNG.swift (SplitMix64).
// Uses BigInt because JavaScript numbers can't hold 64-bit integers exactly.
const MASK = (1n << 64n) - 1n;

export class SplitMix64 {
  state: bigint;
  constructor(seed: bigint) {
    this.state = seed & MASK;
  }
  next(): bigint {
    this.state = (this.state + 0x9e3779b97f4a7c15n) & MASK;
    let z = this.state;
    z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) & MASK;
    z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) & MASK;
    return z ^ (z >> 31n);
  }
  /** Integer in 0..<n (n > 0). Same as Swift `Int(next() % UInt64(n))`. */
  int(n: number): number {
    return Number(this.next() % BigInt(n));
  }
}
