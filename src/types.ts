import Phaser from 'phaser'
import type { ShotType } from './weapon'

// A moving object: position + velocity + a shape to draw it. Base for every
// moving thing (projectiles, shards, stars, enemies, bullets) — same
// integration math. Subtype-specific data lives on the extending interfaces,
// not here, so this stays lean.
export interface Body {
  pos: Phaser.Math.Vector2
  vel: Phaser.Math.Vector2
  radius: number
  // A shape with setPosition/setFillStyle — a circle (Arc), triangle, or star.
  gfx: Phaser.GameObjects.Shape
  dead: boolean
  age: number // seconds alive so far
  life: number // seconds until it detonates (0 = never)
}

// A player shot. All its behavior (damage, homing, bounces, shape) comes from
// its ShotType — no per-flag branching on the Body.
export interface Projectile extends Body {
  shot: ShotType
  bouncesLeft: number // mutable copy of shot.bounces
}

// A collectible star.
export interface Star extends Body {
  value: number
}

// An enemy bullet. accelY lets some bullets accelerate downward (gravity drop).
export interface Bullet extends Body {
  accelY: number
}

// Context handed to an enemy's per-frame `act` (bosses use it to fire + move).
export interface ActContext {
  scene: Phaser.Scene
  playerPos: Phaser.Math.Vector2
  fire: (x: number, y: number, vx: number, vy: number, accelY: number) => void
}

// An expanding, fading ring flash left behind when a shot detonates.
export interface Explosion {
  age: number // seconds since detonation
  gfx: Phaser.GameObjects.Arc
  dead: boolean
}

// A live enemy instance — a Body plus per-type state.
export interface Enemy extends Body {
  type: EnemyType
  hp: number
  originX: number // spawn x, anchor for patterned movement
  originY: number // spawn y, anchor for patterned movement (e.g. orbit center)
  flash: number // seconds of hit-flash remaining (0 = normal color)
  fireTimer: number // seconds since this enemy last fired (if it can fire)
}

// Data-driven enemy definition. Add a new enemy kind = add one of these to the
// table in enemy.ts. Behavior differences live in `move` / `onDeath`, not in
// subclasses. `move` mutates the enemy's position each frame.
export interface EnemyType {
  key: string
  radius: number
  color: number
  hp: number
  speed: number // px/s, meaning depends on the movement pattern
  points: number // score awarded on kill
  fireInterval?: number // seconds between shots; omitted = enemy never fires
  invincible?: boolean // absorbs shots, never dies, no debris (a shield)
  boss?: boolean // exempt from the top-zone clamp; contact with player kills
  move: (e: Enemy, dt: number) => void
  // Optional richer behavior (movement + firing) — used by the boss. Runs in
  // place of `move` when present.
  act?: (e: Enemy, dt: number, ctx: ActContext) => void
  // Optional death effect (e.g. splitter spawning children). `spawn` lets the
  // effect create more enemies without knowing about the scene/list wiring.
  onDeath?: (e: Enemy, spawn: (type: EnemyType, x: number, y: number) => void) => void
}

// Anything with a graphic that can be reaped when dead.
export interface Perishable {
  dead: boolean
  gfx: Phaser.GameObjects.GameObject
}
