import Phaser from 'phaser'
import { DESIGN_WIDTH, DESIGN_HEIGHT, TUNING } from './config'
import type { Body } from './types'
import { spawnBody, integrate, overlaps } from './physics'

// Spawn one enemy at a random x along the top, falling straight down.
// (Enemies are currently disabled in the scene; wire the spawn timer to enable.)
export function spawnDebris(scene: Phaser.Scene, list: Body[]) {
  const x = Phaser.Math.Between(TUNING.DEBRIS_RADIUS, DESIGN_WIDTH - TUNING.DEBRIS_RADIUS)
  spawnBody(
    scene,
    list,
    x,
    -TUNING.DEBRIS_RADIUS,
    0,
    TUNING.DEBRIS_FALL_SPEED,
    TUNING.DEBRIS_RADIUS,
    TUNING.COLOR_DEBRIS,
    0,
  )
}

// Move debris; despawn once past the bottom. Returns true if any hit the player.
export function updateDebris(
  list: Body[],
  dt: number,
  playerPos: Phaser.Math.Vector2,
  playerRadius: number,
): boolean {
  for (const d of list) {
    integrate(d, dt)
    if (overlaps(d, playerPos, playerRadius)) return true
    if (d.pos.y > DESIGN_HEIGHT + 50) d.dead = true
  }
  return false
}
