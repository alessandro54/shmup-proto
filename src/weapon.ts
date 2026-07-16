import { TUNING } from './config'

// ============================================================================
// SHOT TYPE TABLE — the single place shot variety lives (mirrors the enemy
// table). Add a shot kind = add a ShotType. Per-projectile behavior lives here,
// not as scattered flags on the Body.
// ============================================================================
export interface ShotType {
  key: string
  color: number
  shape: 'circle' | 'triangle'
  damage: number
  homing: boolean // steers toward enemies + never dives
  bounces: number // wall bounces before bursting
  fan: number // shots fired per launch
  spreadDeg: number // half-angle between fan shots
  radiusScale: number // size relative to PROJECTILE_RADIUS
}

// Straight, single, full-damage.
export const SHOT_NORMAL: ShotType = {
  key: 'normal',
  color: TUNING.COLOR_PROJECTILE,
  shape: 'circle',
  damage: TUNING.NORMAL_DAMAGE,
  homing: false,
  bounces: 0,
  fan: 1,
  spreadDeg: 0,
  radiusScale: 1,
}

// Weak, steers onto targets (imperfectly), triangle.
export const SHOT_HOMING: ShotType = {
  key: 'homing',
  color: TUNING.COLOR_HOMING,
  shape: 'triangle',
  damage: TUNING.HOMING_DAMAGE,
  homing: true,
  bounces: 0,
  fan: 1,
  spreadDeg: 0,
  radiusScale: 1.6,
}

// 3-shot fan; each is weak but bounces off a wall once.
export const SHOT_SPLIT: ShotType = {
  key: 'split',
  color: TUNING.COLOR_SPLIT,
  shape: 'circle',
  damage: TUNING.SPLIT_DAMAGE,
  homing: false,
  bounces: TUNING.SPLIT_BOUNCES,
  fan: 3,
  spreadDeg: TUNING.TRIPLE_SPREAD_DEG,
  radiusScale: 0.85,
}

// Pick the shot for the current input: homing modifier wins; else a held swipe
// splits; else a plain single shot.
export function pickShot(homing: boolean, held: boolean): ShotType {
  if (homing) return SHOT_HOMING
  if (held) return SHOT_SPLIT
  return SHOT_NORMAL
}
