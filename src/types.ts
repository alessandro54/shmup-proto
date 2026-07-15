import Phaser from 'phaser'

// A moving object: position + velocity + a Graphics shape to draw it.
// Reused for projectiles, shards, and debris — same integration math.
export interface Body {
  pos: Phaser.Math.Vector2
  vel: Phaser.Math.Vector2
  radius: number
  gfx: Phaser.GameObjects.Arc
  dead: boolean
  age: number // seconds alive so far
  life: number // seconds until it detonates (0 = never, e.g. shards/debris)
}

// An expanding, fading ring flash left behind when a shot detonates.
export interface Explosion {
  age: number // seconds since detonation
  gfx: Phaser.GameObjects.Arc
  dead: boolean
}

// Anything with a graphic that can be reaped when dead.
export interface Perishable {
  dead: boolean
  gfx: Phaser.GameObjects.GameObject
}
