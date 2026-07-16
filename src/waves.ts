import { DESIGN_WIDTH, TUNING } from './config'
import type { EnemyType } from './types'
import { ENEMY_TYPES } from './enemy'

// One enemy to place: a type + spawn position.
export interface Spawn {
  type: EnemyType
  x: number
  y: number
}

// A wave = a batch of enemies spawned together. The next wave spawns once the
// current one is fully cleared. A stage = an ordered list of waves.
export type Wave = Spawn[]
export type Stage = Wave[]

const { FALLER, STATIC, SHIELD, ORBITER, DRIFTER, BOSS } = ENEMY_TYPES

// Handy anchors.
const TOP = 60 // spawn y near the top edge
const STATIC_Y = TUNING.ACTIVE_ZONE_Y * 0.28 // statics sit in the upper-mid band
const SHIELD_Y = TUNING.ACTIVE_ZONE_Y * 0.62 // shields sit lower, in the shot path

// ============================================================================
// STAGE 1
//   Wave 1 — two fallers entering from the top-left.
//   Wave 2 — two big statics that shoot at the player.
// Edit freely; add waves/stages here without touching game logic.
// ============================================================================
export const STAGE_1: Stage = [
  [
    { type: FALLER, x: DESIGN_WIDTH * 0.25, y: TOP },
    { type: FALLER, x: DESIGN_WIDTH * 0.75, y: TOP },
  ],
  // Wave 2 — two drifters sweeping left↔right in opposite phase (they cross).
  [
    { type: DRIFTER, x: DESIGN_WIDTH * 0.25, y: TOP }, // starts sweeping right
    { type: DRIFTER, x: DESIGN_WIDTH * 0.75, y: TOP + 90 }, // starts sweeping left
  ],
  [
    { type: STATIC, x: DESIGN_WIDTH * 0.3, y: STATIC_Y },
    { type: STATIC, x: DESIGN_WIDTH * 0.7, y: STATIC_Y },
  ],
  // Wave 3 — a static shielded from straight shots. The shield sits lower in
  // the same column; you must arc/angle a shot around it to kill the static.
  [
    { type: STATIC, x: DESIGN_WIDTH * 0.5, y: STATIC_Y },
    { type: SHIELD, x: DESIGN_WIDTH * 0.5, y: SHIELD_Y },
  ],
  // Wave 4 — three shields in a triangle at the top, plus one orbiter circling
  // its center. Kill the orbiter (the only killable enemy) to clear.
  [
    { type: SHIELD, x: DESIGN_WIDTH * 0.5, y: TOP }, // apex
    { type: SHIELD, x: DESIGN_WIDTH * 0.3, y: TOP + 130 }, // bottom-left
    { type: SHIELD, x: DESIGN_WIDTH * 0.7, y: TOP + 130 }, // bottom-right
    { type: ORBITER, x: DESIGN_WIDTH * 0.5, y: TUNING.ACTIVE_ZONE_Y * 0.55 },
  ],
  // Wave 5 — BOSS finale.
  [{ type: BOSS, x: DESIGN_WIDTH * 0.5, y: TUNING.BOSS_TOP_Y }],
]

export const STAGES: Stage[] = [STAGE_1]
