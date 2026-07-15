import Phaser from 'phaser'
import { TUNING } from './config'
import type { Explosion } from './types'

// Spawn a ring flash at (x,y). Starts tiny + opaque; update grows + fades it.
export function spawnExplosion(scene: Phaser.Scene, list: Explosion[], x: number, y: number) {
  const gfx = scene.add.circle(x, y, 1).setStrokeStyle(4, TUNING.COLOR_EXPLOSION, 1).setFillStyle()
  list.push({ age: 0, gfx, dead: false })
}

// Grow + fade each ring over EXPLOSION_DURATION, then mark it dead.
export function updateExplosions(list: Explosion[], dt: number) {
  for (const ex of list) {
    ex.age += dt
    const t = ex.age / TUNING.EXPLOSION_DURATION
    if (t >= 1) {
      ex.dead = true
    } else {
      ex.gfx.setRadius(t * TUNING.EXPLOSION_RADIUS).setAlpha(1 - t)
    }
  }
}
