/**
 * Ported from Character-Animator-two (grudge-game/world/footIkMath.ts).
 */
export const FOOT_IK = {
  enabled: true,
  rayUp: 0.6,
  rayDown: 1.2,
  maxPelvisDrop: 0.5,
  maxStep: 0.55,
  reachMargin: 0.02,
  weightRate: 12,
} as const;

export type FootIkTune = {
  enabled: boolean;
  maxPelvisDrop: number;
  maxStep: number;
  weightRate: number;
};

export function lawOfCosinesAngle(a: number, b: number, c: number): number {
  if (a <= 0 || b <= 0) return 0;
  const cos = (a * a + b * b - c * c) / (2 * a * b);
  return Math.acos(Math.max(-1, Math.min(1, cos)));
}

export function clampReach(dist: number, thigh: number, calf: number, margin: number): number {
  const min = Math.abs(thigh - calf) + margin;
  const max = thigh + calf - margin;
  if (max <= min) return min;
  return Math.max(min, Math.min(max, dist));
}

export function solveTwoBoneAngles(
  thigh: number,
  calf: number,
  dist: number,
): { hip: number; knee: number } {
  return {
    hip: lawOfCosinesAngle(thigh, dist, calf),
    knee: lawOfCosinesAngle(thigh, calf, dist),
  };
}

export function pelvisDrop(deltas: number[], maxDrop: number): number {
  if (deltas.length === 0) return 0;
  let minDelta = 0;
  for (const d of deltas) if (d < minDelta) minDelta = d;
  return Math.max(-maxDrop, minDelta);
}

export function dampWeight(current: number, target: number, rate: number, dt: number): number {
  if (dt <= 0) return current;
  return current + (target - current) * (1 - Math.exp(-rate * dt));
}