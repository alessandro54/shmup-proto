import Phaser from 'phaser'
import { TUNING } from './config'
import type { Body } from './types'
import { spawnBody, integrate, fullyOffScreen, overlaps } from './physics'

// Fling one or more concentric rings of shards outward from (x,y). Ring 0 is
// fastest; each inner ring is slower, so the rings separate over time. Shards
// fly straight (no gravity, no fade) until they leave the screen.
export function spawnBurst(scene: Phaser.Scene, list: Body[], x: number, y: number) {
  let ringSpeed = TUNING.SHARD_SPEED
  for (let r = 0; r < TUNING.SHARD_RINGS; r++) {
    // Stagger each ring's angles by a fraction of a step so rings don't
    // perfectly overlap — spreads the gaps for better coverage.
    const angleOffset = (r / TUNING.SHARD_RINGS) * ((Math.PI * 2) / TUNING.SHARD_COUNT)
    for (let i = 0; i < TUNING.SHARD_COUNT; i++) {
      const angle = angleOffset + (i / TUNING.SHARD_COUNT) * Math.PI * 2
      const vx = Math.cos(angle) * ringSpeed
      const vy = Math.sin(angle) * ringSpeed
      spawnBody(scene, list, x, y, vx, vy, TUNING.SHARD_RADIUS, TUNING.COLOR_SHARD, 0)
    }
    ringSpeed *= TUNING.SHARD_RING_SPEED_RATIO
  }
}

// Move shards; despawn off-screen. Returns true if any shard hit the player.
export function updateShards(
  list: Body[],
  dt: number,
  playerPos: Phaser.Math.Vector2,
  playerRadius: number,
): boolean {
  for (const s of list) {
    integrate(s, dt)
    if (overlaps(s, playerPos, playerRadius)) return true
    if (fullyOffScreen(s)) s.dead = true
  }
  return false
}
