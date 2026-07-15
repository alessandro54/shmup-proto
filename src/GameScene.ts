import Phaser from 'phaser'
import { DESIGN_WIDTH, DESIGN_HEIGHT, TUNING } from './config'
import type { Body, Explosion } from './types'
import { reap } from './physics'
import { launchFromFlick, updateProjectiles } from './projectile'
import { updateShards } from './shard'
import { updateExplosions } from './explosion'
// import { spawnDebris, updateDebris } from './debris' // enemies disabled

// Re-export so main.ts keeps importing the design resolution from here.
export { DESIGN_WIDTH, DESIGN_HEIGHT }

export class GameScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Arc
  private playerPos = new Phaser.Math.Vector2(DESIGN_WIDTH / 2, TUNING.PLAYER_Y)

  private projectiles: Body[] = []
  private shards: Body[] = []
  private debris: Body[] = []
  private explosions: Explosion[] = []

  // Input state. A drag is either MOVING the player or AIMING a launch,
  // decided at pointerdown by whether the touch grabbed the player.
  private mode: 'none' | 'move' | 'aim' = 'none'
  private dragStart: Phaser.Math.Vector2 | null = null

  private gameOver = false
  private hud!: Phaser.GameObjects.Text
  private score = 0
  private aimLine!: Phaser.GameObjects.Graphics

  constructor() {
    super('game')
  }

  create() {
    // Dead-zone divider: dim the blocked top half, draw a bold boundary line.
    this.add.rectangle(0, 0, DESIGN_WIDTH, TUNING.ACTIVE_ZONE_Y, 0x000000, 0.25).setOrigin(0, 0)
    this.add
      .line(0, TUNING.ACTIVE_ZONE_Y, 0, 0, DESIGN_WIDTH, 0, TUNING.COLOR_ACCENT, 0.9)
      .setOrigin(0, 0)
      .setLineWidth(4)

    this.player = this.add.circle(0, 0, TUNING.PLAYER_RADIUS, TUNING.COLOR_PLAYER)
    this.aimLine = this.add.graphics()
    this.hud = this.add
      .text(24, 24, '', { fontFamily: 'monospace', fontSize: '32px', color: '#888888' })
      .setDepth(100)

    this.setupInput()
    this.resetState()
  }

  // --------------------------------------------------------------------------
  // State lifecycle
  // --------------------------------------------------------------------------
  private resetState() {
    for (const list of [this.projectiles, this.shards, this.debris, this.explosions]) {
      list.forEach((o) => o.gfx.destroy())
    }
    this.projectiles = []
    this.shards = []
    this.debris = []
    this.explosions = []
    this.score = 0
    this.gameOver = false
    this.mode = 'none'
    this.dragStart = null
    this.aimLine.clear()
    this.playerPos.set(DESIGN_WIDTH / 2, TUNING.PLAYER_Y)
    this.player.setPosition(this.playerPos.x, this.playerPos.y).setFillStyle(TUNING.COLOR_PLAYER)
  }

  // --------------------------------------------------------------------------
  // Input
  // --------------------------------------------------------------------------
  private setupInput() {
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.gameOver) return this.resetState()
      // Dead zone: ignore any touch in the top half of the screen.
      if (p.y < TUNING.ACTIVE_ZONE_Y) {
        this.mode = 'none'
        return
      }
      // Touched near the player = MOVE, else = AIM.
      const grabbed =
        Phaser.Math.Distance.Between(p.x, p.y, this.playerPos.x, this.playerPos.y) <= TUNING.PLAYER_GRAB_DIST
      this.mode = grabbed ? 'move' : 'aim'
      this.dragStart = grabbed ? null : new Phaser.Math.Vector2(p.x, p.y)
    })

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (this.gameOver) return
      if (this.mode === 'move') {
        this.movePlayerTo(p.x, p.y)
      } else if (this.mode === 'aim' && this.dragStart) {
        this.drawAim(this.dragStart, p.x - this.dragStart.x, p.y - this.dragStart.y)
      }
    })

    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      this.aimLine.clear()
      if (!this.gameOver && this.mode === 'aim' && this.dragStart) {
        launchFromFlick(this, this.projectiles, this.dragStart, p.x - this.dragStart.x, p.y - this.dragStart.y)
      }
      this.mode = 'none'
      this.dragStart = null
    })
  }

  // Move the player, clamped to the bottom-half zone.
  private movePlayerTo(x: number, y: number) {
    this.playerPos.set(
      Phaser.Math.Clamp(x, TUNING.PLAYER_RADIUS, DESIGN_WIDTH - TUNING.PLAYER_RADIUS),
      Phaser.Math.Clamp(y, TUNING.ACTIVE_ZONE_Y + TUNING.PLAYER_RADIUS, DESIGN_HEIGHT - TUNING.PLAYER_RADIUS),
    )
    this.player.setPosition(this.playerPos.x, this.playerPos.y)
  }

  // Aim line from the tap point, in the flick direction, length ~ strength.
  private drawAim(origin: Phaser.Math.Vector2, dragX: number, dragY: number) {
    this.aimLine.clear()
    const len = Math.hypot(dragX, dragY)
    if (len < TUNING.FLICK_DEADZONE) return
    const drawLen = Math.min(len, TUNING.AIM_LINE_MAX)
    this.aimLine.lineStyle(4, TUNING.COLOR_ACCENT, 0.8)
    this.aimLine.beginPath()
    this.aimLine.moveTo(origin.x, origin.y)
    this.aimLine.lineTo(origin.x + (dragX / len) * drawLen, origin.y + (dragY / len) * drawLen)
    this.aimLine.strokePath()
  }

  // ==========================================================================
  // MAIN LOOP. `delta` = ms since last frame; -> seconds for px/s constants.
  // ==========================================================================
  update(_time: number, delta: number) {
    if (this.gameOver) return
    const dt = delta / 1000

    // Enemies disabled. To enable: spawn on a timer + run updateDebris here,
    // ending the game if it returns true (see ./debris).

    updateProjectiles(this, this.projectiles, this.shards, this.explosions, dt)
    updateExplosions(this.explosions, dt)
    // A shot's own shards can kill the player — dodge your shrapnel.
    if (updateShards(this.shards, dt, this.playerPos, TUNING.PLAYER_RADIUS)) {
      return this.triggerGameOver()
    }

    this.projectiles = reap(this.projectiles)
    this.shards = reap(this.shards)
    this.debris = reap(this.debris)
    this.explosions = reap(this.explosions)

    this.hud.setText(`SCORE ${this.score}`)
  }

  private triggerGameOver() {
    this.gameOver = true
    this.player.setFillStyle(TUNING.COLOR_PLAYER_DEAD)
    this.aimLine.clear()
    this.add
      .text(DESIGN_WIDTH / 2, DESIGN_HEIGHT / 2, 'GAME OVER\ntap to restart', {
        fontFamily: 'monospace',
        fontSize: '48px',
        color: '#ffffff',
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(200)
      .setName('gameover-text')

    this.input.once('pointerdown', () => this.children.getByName('gameover-text')?.destroy())
  }
}
