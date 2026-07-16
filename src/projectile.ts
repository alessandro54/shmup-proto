import Phaser from 'phaser'
import { DESIGN_WIDTH, DESIGN_HEIGHT, TUNING } from './config'
import type { Body, Enemy, Explosion, Projectile } from './types'
import type { ShotType } from './weapon'
import { spawnBody, integrate, touchesEdge, fullyOffScreen } from './physics'
import { spawnBurst } from './shard'
import { spawnExplosion } from './explosion'

// Fire a shot of the given ShotType from `origin` along the swipe. Returns the
// number of projectiles fired (0 if the swipe was too small / pointed down).
export function launchShot(
  scene: Phaser.Scene,
  list: Projectile[],
  origin: Phaser.Math.Vector2,
  dragX: number,
  dragY: number,
  shot: ShotType,
): number {
  const dragLen = Math.hypot(dragX, dragY)
  if (dragLen < TUNING.FLICK_DEADZONE) return 0
  if (dragY >= 0) return 0 // no shooting backwards (downward)

  const speed = Phaser.Math.Clamp(
    dragLen * TUNING.FLICK_SENSITIVITY,
    TUNING.MIN_LAUNCH_SPEED,
    TUNING.MAX_LAUNCH_SPEED,
  )
  const baseAngle = Math.atan2(dragY, dragX)
  const spread = Phaser.Math.DegToRad(shot.spreadDeg)
  // Fan the shot's `fan` count evenly around the swipe direction.
  const offsets =
    shot.fan <= 1 ? [0] : Array.from({ length: shot.fan }, (_, i) => (i - (shot.fan - 1) / 2) * spread)

  const radius = TUNING.PROJECTILE_RADIUS * shot.radiusScale
  for (const off of offsets) {
    const a = baseAngle + off
    const base = spawnBody(
      scene,
      [],
      origin.x,
      origin.y,
      Math.cos(a) * speed,
      Math.sin(a) * speed,
      radius,
      shot.color,
      TUNING.SHOT_LIFE_FAILSAFE,
    )
    // Swap the shape if the type calls for it.
    if (shot.shape === 'triangle') {
      base.gfx.destroy()
      base.gfx = scene.add.triangle(origin.x, origin.y, 0, -radius, -radius * 0.9, radius * 0.8, radius * 0.9, radius * 0.8, shot.color)
    }
    list.push({ ...base, shot, bouncesLeft: shot.bounces })
  }
  return offsets.length
}

// Fly projectiles; homing ones steer. Bursts on reaching an edge in the top
// zone (bouncing first if the shot has bounces left), or on the failsafe.
export function updateProjectiles(
  scene: Phaser.Scene,
  projectiles: Projectile[],
  enemies: Enemy[],
  shards: Body[],
  explosions: Explosion[],
  dt: number,
) {
  for (const p of projectiles) {
    if (p.shot.homing) steerHoming(p, enemies, dt)
    integrate(p, dt)
    p.age += dt

    // A shot that has bounced and dropped back below the middle didn't find a
    // target — fade it out instead of letting it fly back at the player.
    const hasBounced = p.bouncesLeft < p.shot.bounces
    if (hasBounced && p.pos.y > TUNING.ACTIVE_ZONE_Y) {
      p.gfx.alpha -= dt / TUNING.PROJECTILE_FADE_TIME
      if (p.gfx.alpha <= 0) p.dead = true
      continue
    }

    const inTopZone = p.pos.y <= TUNING.ACTIVE_ZONE_Y
    if (inTopZone && touchesEdge(p)) {
      if (p.bouncesLeft > 0) {
        p.bouncesLeft -= 1
        bounceOffEdge(p)
      } else {
        burst(scene, shards, explosions, p)
      }
    } else if (p.age >= p.life) {
      burst(scene, shards, explosions, p)
    } else if (fullyOffScreen(p)) {
      p.dead = true
    }
  }
}

// Reflect a projectile off whichever edge it touched, nudging it inside and
// damping its speed so the rebound is slower than the incoming shot.
function bounceOffEdge(p: Body) {
  if (p.pos.x - p.radius <= 0) {
    p.pos.x = p.radius
    p.vel.x = Math.abs(p.vel.x)
  } else if (p.pos.x + p.radius >= DESIGN_WIDTH) {
    p.pos.x = DESIGN_WIDTH - p.radius
    p.vel.x = -Math.abs(p.vel.x)
  }
  if (p.pos.y - p.radius <= 0) {
    p.pos.y = p.radius
    p.vel.y = Math.abs(p.vel.y)
  }
  p.vel.x *= TUNING.SPLIT_BOUNCE_DAMP
  p.vel.y *= TUNING.SPLIT_BOUNCE_DAMP
  p.gfx.setPosition(p.pos.x, p.pos.y)
}

// Detonate a projectile: missed shots burst with fewer rings than a kill.
function burst(scene: Phaser.Scene, shards: Body[], explosions: Explosion[], p: Body) {
  detonate(
    scene,
    shards,
    explosions,
    Phaser.Math.Clamp(p.pos.x, p.radius, DESIGN_WIDTH - p.radius),
    Phaser.Math.Clamp(p.pos.y, p.radius, DESIGN_HEIGHT - p.radius),
    TUNING.SHARD_MISS_RINGS,
  )
  p.dead = true
}

// Nudge a homing shot toward the nearest killable enemy WITHIN SEEK RANGE —
// lazily (capped turn), with a wobbly aim, and it NEVER dives: it always keeps
// a minimum upward velocity, so overshooting an enemy sends it up to the top
// rather than U-turning back down.
function steerHoming(p: Body, enemies: Enemy[], dt: number) {
  let nearest: Enemy | null = null
  let best = TUNING.HOMING_SEEK_RADIUS // ignore anything beyond the seek radius
  for (const e of enemies) {
    if (e.dead || e.type.invincible) continue // shields aren't targets
    const d = Phaser.Math.Distance.Between(p.pos.x, p.pos.y, e.pos.x, e.pos.y)
    if (d < best) {
      best = d
      nearest = e
    }
  }

  const speed = Math.hypot(p.vel.x, p.vel.y) || 1

  if (nearest) {
    // Wobbly aim: jitter the desired angle so it isn't laser-accurate.
    const jitter = Phaser.Math.DegToRad(TUNING.HOMING_JITTER_DEG) * (Math.random() * 2 - 1)
    const desired = Math.atan2(nearest.pos.y - p.pos.y, nearest.pos.x - p.pos.x) + jitter
    const current = Math.atan2(p.vel.y, p.vel.x)
    const diff = Phaser.Math.Angle.Wrap(desired - current)
    const step = Phaser.Math.Clamp(diff, -TUNING.HOMING_TURN * dt, TUNING.HOMING_TURN * dt)
    const a = current + step
    p.vel.x = Math.cos(a) * speed
    p.vel.y = Math.sin(a) * speed
  }

  // Never dive: keep at least HOMING_MIN_CLIMB of the speed going UP.
  const minUp = speed * TUNING.HOMING_MIN_CLIMB
  if (p.vel.y > -minUp) {
    p.vel.y = -minUp
    const rem = Math.sqrt(Math.max(0, speed * speed - p.vel.y * p.vel.y))
    p.vel.x = Math.sign(p.vel.x || 1) * rem
  }
}

// x,y = burst center; rings = shard rings to spawn (kill vs miss).
export function detonate(
  scene: Phaser.Scene,
  shards: Body[],
  explosions: Explosion[],
  x: number,
  y: number,
  rings: number,
) {
  spawnExplosion(scene, explosions, x, y)
  spawnBurst(scene, shards, x, y, rings)
}
