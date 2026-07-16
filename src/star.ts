import Phaser from 'phaser'
import { DESIGN_HEIGHT, TUNING } from './config'
import type { Star } from './types'
import { spawnBody, overlaps } from './physics'

// Drop a star worth `value` at (x,y). Falls straight down; bigger value =
// bigger star. Drawn as an actual 5-point star shape.
export function spawnStar(scene: Phaser.Scene, list: Star[], x: number, y: number, value: number) {
  const radius = TUNING.STAR_MIN_RADIUS + value * TUNING.STAR_RADIUS_PER_VALUE
  // spawnBody makes a circle we don't want; swap it for a star polygon.
  const base = spawnBody(scene, [], x, y, 0, TUNING.STAR_FALL_SPEED, radius, TUNING.COLOR_STAR, 0)
  base.gfx.destroy()
  base.gfx = scene.add.star(x, y, 5, radius * 0.5, radius, TUNING.COLOR_STAR)
  list.push({ ...base, value })
}

// Stars fall; when the player is within STAR_MAGNET_RADIUS they're pulled in.
// Catch on overlap, lose off the bottom. Returns the value collected this frame.
export function updateStars(
  list: Star[],
  dt: number,
  playerPos: Phaser.Math.Vector2,
  playerRadius: number,
): number {
  let collected = 0
  for (const s of list) {
    const dx = playerPos.x - s.pos.x
    const dy = playerPos.y - s.pos.y
    const dist = Math.hypot(dx, dy) || 1

    if (dist <= TUNING.STAR_MAGNET_RADIUS) {
      // Magnet: move straight toward the player at magnet speed.
      s.pos.x += (dx / dist) * TUNING.STAR_MAGNET_SPEED * dt
      s.pos.y += (dy / dist) * TUNING.STAR_MAGNET_SPEED * dt
    } else {
      // Otherwise just fall.
      s.pos.y += TUNING.STAR_FALL_SPEED * dt
    }
    s.gfx.setPosition(s.pos.x, s.pos.y)

    if (overlaps(s, playerPos, playerRadius)) {
      collected += s.value
      s.dead = true
    } else if (s.pos.y > DESIGN_HEIGHT + s.radius) {
      s.dead = true // fell off the bottom — lost
    }
  }
  return collected
}
