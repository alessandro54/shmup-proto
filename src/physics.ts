import Phaser from 'phaser'
import { DESIGN_WIDTH, DESIGN_HEIGHT } from './config'
import type { Body, Perishable } from './types'

// Single factory for every Body. Creates the graphic, pushes into `list`.
export function spawnBody(
  scene: Phaser.Scene,
  list: Body[],
  x: number,
  y: number,
  vx: number,
  vy: number,
  radius: number,
  color: number,
  life: number,
) {
  list.push({
    pos: new Phaser.Math.Vector2(x, y),
    vel: new Phaser.Math.Vector2(vx, vy),
    radius,
    gfx: scene.add.circle(x, y, radius, color),
    dead: false,
    age: 0,
    life,
  })
}

// Euler integration: position += velocity * dt, then sync the graphic.
export function integrate(b: Body, dt: number) {
  b.pos.x += b.vel.x * dt
  b.pos.y += b.vel.y * dt
  b.gfx.setPosition(b.pos.x, b.pos.y)
}

// True once a body is FULLY past any screen edge (used to despawn).
export function fullyOffScreen(b: Body): boolean {
  return (
    b.pos.x < -b.radius ||
    b.pos.x > DESIGN_WIDTH + b.radius ||
    b.pos.y < -b.radius ||
    b.pos.y > DESIGN_HEIGHT + b.radius
  )
}

// True the moment a body's circle touches any screen edge (used to detonate).
export function touchesEdge(b: Body): boolean {
  return (
    b.pos.x - b.radius <= 0 ||
    b.pos.x + b.radius >= DESIGN_WIDTH ||
    b.pos.y - b.radius <= 0 ||
    b.pos.y + b.radius >= DESIGN_HEIGHT
  )
}

// Circle-vs-circle overlap test (sum-of-radii).
export function overlaps(b: Body, center: Phaser.Math.Vector2, radius: number): boolean {
  return Phaser.Math.Distance.Between(b.pos.x, b.pos.y, center.x, center.y) < b.radius + radius
}

// Remove dead items, destroying their graphics. Works for any Perishable.
export function reap<T extends Perishable>(list: T[]): T[] {
  const alive: T[] = []
  for (const o of list) {
    if (o.dead) o.gfx.destroy()
    else alive.push(o)
  }
  return alive
}
