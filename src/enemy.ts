import Phaser from 'phaser'
import { DESIGN_WIDTH, TUNING } from './config'
import type { Body, Enemy, EnemyType, Projectile } from './types'
import { spawnBody, integrate, overlaps, fullyOffScreen } from './physics'

// ============================================================================
// ENEMY TYPE TABLE — the single place enemy variety lives.
// Add a kind = add an entry. Movement is a stateless function of the enemy's
// age + spawn x (no per-frame state to track), so patterns stay pure and easy
// to tune. `move` mutates e.pos directly; the scene syncs the graphic + checks
// collisions afterward.
// ============================================================================

// STATIC: sits where it spawns. Big, tanky, and FIRES at the player.
const STATIC: EnemyType = {
  key: 'static',
  radius: 44, // big
  color: TUNING.COLOR_ENEMY_STATIC,
  hp: 6, // tanky — many hits to destroy
  speed: 0,
  points: 3,
  fireInterval: TUNING.STATIC_FIRE_INTERVAL,
  move: () => {},
}

// FALLER: classic straight top→bottom drop.
const FALLER: EnemyType = {
  key: 'faller',
  radius: 20,
  color: TUNING.COLOR_ENEMY_FALLER,
  hp: 1,
  speed: 150,
  points: 1,
  move: (e, dt) => {
    e.pos.y += e.type.speed * dt
  },
}

// DRIFTER: wide, slow left↔right patrol while creeping down. The sine spans
// most of the screen width so it reads as an L↔R sweep.
const DRIFTER: EnemyType = {
  key: 'drifter',
  radius: 18,
  color: TUNING.COLOR_ENEMY_DRIFTER,
  hp: 1,
  speed: 60, // descent speed
  points: 2,
  move: (e, dt) => {
    e.pos.y += e.type.speed * dt
    const amp = DESIGN_WIDTH / 2 - e.radius
    // Phase from spawn side: left-spawned starts going right, right-spawned
    // starts going left — so two drifters cross instead of moving in lockstep.
    const phase = e.originX < DESIGN_WIDTH / 2 ? 0 : Math.PI
    e.pos.x = DESIGN_WIDTH / 2 + Math.sin(e.age * TUNING.DRIFT_SWEEP_FREQ + phase) * amp
  },
}

// WEAVER: descends while weaving in a tight sine around its spawn x.
const WEAVER: EnemyType = {
  key: 'weaver',
  radius: 18,
  color: TUNING.COLOR_ENEMY_WEAVER,
  hp: 2,
  speed: 120,
  points: 3,
  move: (e, dt) => {
    e.pos.y += e.type.speed * dt
    e.pos.x = e.originX + Math.sin(e.age * TUNING.ENEMY_WEAVE_FREQ) * TUNING.ENEMY_WEAVE_AMP
  },
}

// SPLITTER: slow faller that bursts into small fast fallers when killed.
const SPLITTER: EnemyType = {
  key: 'splitter',
  radius: 26,
  color: TUNING.COLOR_ENEMY_SPLITTER,
  hp: 2,
  speed: 70,
  points: 2,
  move: (e, dt) => {
    e.pos.y += e.type.speed * dt
  },
  onDeath: (e, spawn) => {
    const child: EnemyType = { ...FALLER, radius: 12, speed: 260, hp: 1, points: 1 }
    for (let i = 0; i < TUNING.ENEMY_SPLIT_COUNT; i++) {
      const dx = (i - (TUNING.ENEMY_SPLIT_COUNT - 1) / 2) * 40
      spawn(child, e.pos.x + dx, e.pos.y)
    }
  },
}

// ORBITER: circles around its spawn point (an "O" pattern).
const ORBITER: EnemyType = {
  key: 'orbiter',
  radius: 18,
  color: TUNING.COLOR_ENEMY_ORBITER,
  hp: 2,
  speed: 0, // position is fully driven by the orbit below, not by speed
  points: 3,
  move: (e) => {
    e.pos.x = e.originX + Math.cos(e.age * TUNING.ORBIT_FREQ) * TUNING.ORBIT_RADIUS
    e.pos.y = e.originY + Math.sin(e.age * TUNING.ORBIT_FREQ) * TUNING.ORBIT_RADIUS
  },
}

// SHIELD: indestructible cover. Absorbs any shot (no damage, no debris burst)
// and blocks shots from reaching enemies behind it. Never counts as a kill.
const SHIELD: EnemyType = {
  key: 'shield',
  radius: 40,
  color: TUNING.COLOR_ENEMY_SHIELD,
  hp: Infinity,
  speed: 0,
  points: 0,
  invincible: true,
  move: () => {},
}

export const ENEMY_TYPES = { STATIC, FALLER, DRIFTER, WEAVER, SPLITTER, ORBITER, SHIELD }

// --------------------------------------------------------------------------
// Spawning
// --------------------------------------------------------------------------
export function spawnEnemy(scene: Phaser.Scene, list: Enemy[], type: EnemyType, x: number, y: number) {
  list.push({
    pos: new Phaser.Math.Vector2(x, y),
    vel: new Phaser.Math.Vector2(0, 0), // enemies move positionally, not via vel
    radius: type.radius,
    gfx: scene.add.circle(x, y, type.radius, type.color),
    dead: false,
    age: 0,
    life: 0,
    type,
    hp: type.hp,
    originX: x,
    originY: y,
    flash: 0,
    fireTimer: 0,
  })
}

// --------------------------------------------------------------------------
// Update
// --------------------------------------------------------------------------
// Move enemies via their type pattern; sync graphics; fire at the player. Enemies
// are CONFINED to the top zone (never cross the divider) and PERSIST until killed
// — a faller drops to the divider and then sits there as a target.
export function updateEnemies(
  scene: Phaser.Scene,
  list: Enemy[],
  dt: number,
  playerPos: Phaser.Math.Vector2,
  bullets: Body[],
) {
  const floorY = TUNING.ACTIVE_ZONE_Y * TUNING.ENEMY_FLOOR_FRAC // enemies stop here
  for (const e of list) {
    e.age += dt
    e.type.move(e, dt)
    // Clamp inside the top zone (top edge and the enemy floor threshold).
    e.pos.y = Phaser.Math.Clamp(e.pos.y, e.radius, floorY - e.radius)
    e.gfx.setPosition(e.pos.x, e.pos.y)

    // Hit-flash: tint white briefly after taking a non-lethal hit.
    if (e.flash > 0) {
      e.flash -= dt
      e.gfx.setFillStyle(e.flash > 0 ? TUNING.COLOR_ENEMY_FLASH : e.type.color)
    }

    // Firing: shoot a bullet aimed at the player on the fire interval.
    if (e.type.fireInterval) {
      e.fireTimer += dt
      if (e.fireTimer >= e.type.fireInterval) {
        e.fireTimer = 0
        fireBullet(scene, bullets, e.pos, playerPos)
      }
    }
  }
}

// --------------------------------------------------------------------------
// Enemy bullets
// --------------------------------------------------------------------------
function fireBullet(scene: Phaser.Scene, bullets: Body[], from: Phaser.Math.Vector2, target: Phaser.Math.Vector2) {
  const dx = target.x - from.x
  const dy = target.y - from.y
  const d = Math.hypot(dx, dy) || 1
  const vx = (dx / d) * TUNING.ENEMY_BULLET_SPEED
  const vy = (dy / d) * TUNING.ENEMY_BULLET_SPEED
  spawnBody(scene, bullets, from.x, from.y, vx, vy, TUNING.ENEMY_BULLET_RADIUS, TUNING.COLOR_ENEMY_BULLET, 0)
}

// Move enemy bullets straight; despawn off-screen. Returns true if any hit the
// player. (Bullets DO despawn — only enemies persist.)
export function updateEnemyBullets(
  list: Body[],
  dt: number,
  playerPos: Phaser.Math.Vector2,
  playerRadius: number,
): boolean {
  for (const b of list) {
    integrate(b, dt)
    if (overlaps(b, playerPos, playerRadius)) return true
    if (fullyOffScreen(b)) b.dead = true
  }
  return false
}

// --------------------------------------------------------------------------
// Collision: projectiles vs enemies. Each hit costs damage + detonates the
// projectile. A killed enemy DROPS A STAR (worth its points), runs its onDeath
// effect, and refunds homing energy. Returns the normal/homing kill counts.
// --------------------------------------------------------------------------
export function collideProjectiles(
  projectiles: Projectile[],
  enemies: Enemy[],
  detonate: (x: number, y: number) => void,
  spawn: (type: EnemyType, x: number, y: number) => void,
  dropStar: (x: number, y: number, value: number) => void,
): { normalKills: number; homingKills: number } {
  let normalKills = 0
  let homingKills = 0
  for (const p of projectiles) {
    if (p.dead) continue
    for (const e of enemies) {
      if (e.dead) continue
      if (!overlaps(p, e.pos, e.radius)) continue

      // Shield: absorbs non-homing shots (no damage, no debris). Homing shots
      // pass straight through — skip this shield, keep checking other enemies.
      if (e.type.invincible) {
        if (p.shot.homing) continue
        p.dead = true
        e.flash = TUNING.ENEMY_FLASH_TIME
        e.gfx.setFillStyle(TUNING.COLOR_ENEMY_FLASH)
        break
      }

      p.dead = true // projectile spent on a real enemy
      e.hp -= p.shot.damage
      if (e.hp <= 0) {
        // Kill: detonate + drop a star + death effect + energy refund.
        e.dead = true
        dropStar(e.pos.x, e.pos.y, e.type.points)
        if (p.shot.homing) homingKills += 1
        else normalKills += 1
        detonate(p.pos.x, p.pos.y)
        e.type.onDeath?.(e, spawn)
      } else {
        // Survived: no debris burst — just flash the enemy to show the hit.
        e.flash = TUNING.ENEMY_FLASH_TIME
        e.gfx.setFillStyle(TUNING.COLOR_ENEMY_FLASH)
      }
      break // this projectile is spent
    }
  }
  return { normalKills, homingKills }
}
