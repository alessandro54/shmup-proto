import Phaser from 'phaser'
import { DESIGN_WIDTH, DESIGN_HEIGHT, TUNING } from './config'
import type { Body, Explosion } from './types'
import { spawnBody, integrate, touchesEdge } from './physics'
import { spawnBurst } from './shard'
import { spawnExplosion } from './explosion'

// Turn a flick (drag delta from `origin`) into a launched projectile.
export function launchFromFlick(
  scene: Phaser.Scene,
  list: Body[],
  origin: Phaser.Math.Vector2,
  dragX: number,
  dragY: number,
) {
  const dragLen = Math.hypot(dragX, dragY)
  if (dragLen < TUNING.FLICK_DEADZONE) return

  // Speed scales with drag length, then clamp.
  const speed = Phaser.Math.Clamp(
    dragLen * TUNING.FLICK_SENSITIVITY,
    TUNING.MIN_LAUNCH_SPEED,
    TUNING.MAX_LAUNCH_SPEED,
  )
  // Lifetime maps linearly over the speed range: harder flick = longer life.
  const t = Phaser.Math.Clamp(
    (speed - TUNING.MIN_LAUNCH_SPEED) / (TUNING.MAX_LAUNCH_SPEED - TUNING.MIN_LAUNCH_SPEED),
    0,
    1,
  )
  const life = Phaser.Math.Linear(TUNING.LIFE_MIN, TUNING.LIFE_MAX, t)
  // Unit direction * speed = velocity. Spawn at the tap point (drag origin).
  const vx = (dragX / dragLen) * speed
  const vy = (dragY / dragLen) * speed
  spawnBody(scene, list, origin.x, origin.y, vx, vy, TUNING.PROJECTILE_RADIUS, TUNING.COLOR_PROJECTILE, life)
}

// Fly projectiles straight; detonate on life-end OR touching a screen edge.
// Detonation composes a ring flash + a shard burst.
export function updateProjectiles(
  scene: Phaser.Scene,
  projectiles: Body[],
  shards: Body[],
  explosions: Explosion[],
  dt: number,
) {
  for (const p of projectiles) {
    integrate(p, dt)
    p.age += dt
    if (p.age >= p.life) {
      detonate(scene, shards, explosions, p.pos.x, p.pos.y)
      p.dead = true
    } else if (touchesEdge(p)) {
      // Clamp the burst origin to just inside the screen.
      detonate(
        scene,
        shards,
        explosions,
        Phaser.Math.Clamp(p.pos.x, p.radius, DESIGN_WIDTH - p.radius),
        Phaser.Math.Clamp(p.pos.y, p.radius, DESIGN_HEIGHT - p.radius),
      )
      p.dead = true
    }
  }
}

function detonate(scene: Phaser.Scene, shards: Body[], explosions: Explosion[], x: number, y: number) {
  spawnExplosion(scene, explosions, x, y)
  spawnBurst(scene, shards, x, y)
}
