/** mulberry32: small, fast, seeded PRNG. Same seed gives the same sequence on every run. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface Rng {
  next: () => number
  /** Integer in [min, max], inclusive. */
  int: (min: number, max: number) => number
  /** Float in [min, max) rounded to `decimals`. */
  float: (min: number, max: number, decimals?: number) => number
  chance: (p: number) => boolean
  pick: <T>(items: readonly T[]) => T
  shuffle: <T>(items: readonly T[]) => T[]
}

export function createRng(seed: number): Rng {
  const next = mulberry32(seed)
  const int = (min: number, max: number) => Math.floor(next() * (max - min + 1)) + min
  return {
    next,
    int,
    float: (min, max, decimals = 3) => {
      const f = 10 ** decimals
      return Math.round((min + next() * (max - min)) * f) / f
    },
    chance: (p) => next() < p,
    pick: (items) => {
      if (items.length === 0) throw new Error('pick() called with an empty list')
      return items[int(0, items.length - 1)] as (typeof items)[number]
    },
    shuffle: (items) => {
      const out = [...items]
      for (let i = out.length - 1; i > 0; i--) {
        const j = int(0, i)
        const tmp = out[i] as (typeof out)[number]
        out[i] = out[j] as (typeof out)[number]
        out[j] = tmp
      }
      return out
    },
  }
}
