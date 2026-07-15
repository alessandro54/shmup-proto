import Phaser from 'phaser'

// ============================================================================
// DESIGN RESOLUTION (portrait). The Scale manager fits this to any screen.
// ============================================================================
export const DESIGN_WIDTH = 720
export const DESIGN_HEIGHT = 1280

// ============================================================================
// TUNING CONSTANTS — tweak live, HMR reloads instantly.
// Speeds in pixels-per-SECOND (delta-time normalized) so feel is
// framerate-independent.
// ============================================================================
const TUNING = {
  // --- Active input zone ---
  // Only touches BELOW this y react (move + shoot). Above = dead zone.
  ACTIVE_ZONE_Y: DESIGN_HEIGHT / 2,

  // --- Player (bottom) ---
  PLAYER_RADIUS: 26,
  PLAYER_Y: DESIGN_HEIGHT - 120, // fixed height off the bottom
  // Grab radius: a touch within this distance of the player counts as "grab
  // to move" instead of "aim to launch".
  PLAYER_GRAB_DIST: 90,

  // --- Flick-to-shoot ---
  // Launch speed (px/s) scales with drag length.
  FLICK_SENSITIVITY: 6,
  MIN_LAUNCH_SPEED: 500,
  MAX_LAUNCH_SPEED: 1800,
  FLICK_DEADZONE: 18, // min drag px before a flick counts

  // --- Projectiles (fly straight, no gravity) ---
  PROJECTILE_RADIUS: 10,

  // --- Debris / enemies (fall from top toward bottom) ---
  DEBRIS_RADIUS: 20,
  DEBRIS_SPAWN_INTERVAL_MS: 900, // lower = more debris
  DEBRIS_FALL_SPEED: 140, // downward speed (px/s)
}

// A moving object: position + velocity + a Graphics shape to draw it.
interface Body {
  pos: Phaser.Math.Vector2
  vel: Phaser.Math.Vector2
  radius: number
  gfx: Phaser.GameObjects.Arc
  dead: boolean
}

export class GameScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Arc
  private playerX = DESIGN_WIDTH / 2
  private playerY = TUNING.PLAYER_Y

  private projectiles: Body[] = []
  private debris: Body[] = []

  // Input state. A drag is either MOVING the player or AIMING a launch,
  // decided at pointerdown by whether the touch grabbed the player.
  private mode: 'none' | 'move' | 'aim' = 'none'
  private dragStart: Phaser.Math.Vector2 | null = null

  private spawnTimer = 0 // debris disabled; used when re-enabled
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
      .line(0, TUNING.ACTIVE_ZONE_Y, 0, 0, DESIGN_WIDTH, 0, 0x66aaff, 0.9)
      .setOrigin(0, 0)
      .setLineWidth(4)

    // Player at bottom-center.
    this.player = this.add.circle(this.playerX, TUNING.PLAYER_Y, TUNING.PLAYER_RADIUS, 0xdddddd)

    this.aimLine = this.add.graphics()

    this.hud = this.add
      .text(24, 24, '', { fontFamily: 'monospace', fontSize: '32px', color: '#888888' })
      .setDepth(100)

    this.setupInput()
    this.resetState()
  }

  private resetState() {
    this.projectiles.forEach((p) => p.gfx.destroy())
    this.debris.forEach((d) => d.gfx.destroy())
    this.projectiles = []
    this.debris = []
    this.spawnTimer = 0
    this.score = 0
    this.gameOver = false
    this.mode = 'none'
    this.dragStart = null
    this.aimLine.clear()
    this.playerX = DESIGN_WIDTH / 2
    this.playerY = TUNING.PLAYER_Y
    this.player.setPosition(this.playerX, this.playerY)
    this.player.setFillStyle(0xdddddd)
  }

  private setupInput() {
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.gameOver) {
        this.resetState()
        return
      }
      // Dead zone: ignore any touch in the top half of the screen.
      if (p.y < TUNING.ACTIVE_ZONE_Y) {
        this.mode = 'none'
        return
      }
      // Decide intent: touched near the player = MOVE, else = AIM.
      const distToPlayer = Phaser.Math.Distance.Between(p.x, p.y, this.playerX, this.playerY)
      if (distToPlayer <= TUNING.PLAYER_GRAB_DIST) {
        this.mode = 'move'
      } else {
        this.mode = 'aim'
        this.dragStart = new Phaser.Math.Vector2(p.x, p.y)
      }
    })

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (this.gameOver) return
      if (this.mode === 'move') {
        // Move: player follows finger in 2D, clamped to the bottom-half zone.
        this.playerX = Phaser.Math.Clamp(p.x, TUNING.PLAYER_RADIUS, DESIGN_WIDTH - TUNING.PLAYER_RADIUS)
        this.playerY = Phaser.Math.Clamp(
          p.y,
          TUNING.ACTIVE_ZONE_Y + TUNING.PLAYER_RADIUS,
          DESIGN_HEIGHT - TUNING.PLAYER_RADIUS,
        )
        this.player.setPosition(this.playerX, this.playerY)
      } else if (this.mode === 'aim' && this.dragStart) {
        // Aim: draw a line from the tap point in the launch direction.
        // Launch direction = the drag vector (down->up drag = shoot up).
        this.drawAim(p.x - this.dragStart.x, p.y - this.dragStart.y)
      }
    })

    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      this.aimLine.clear()
      if (this.gameOver) return

      if (this.mode === 'aim' && this.dragStart) {
        // --- FLICK VECTOR MATH ---
        // Drag delta = flick vector. Its length sets speed, its direction
        // (normalized) sets travel direction. Projectile flies straight.
        const dragX = p.x - this.dragStart.x
        const dragY = p.y - this.dragStart.y
        const dragLen = Math.hypot(dragX, dragY)

        if (dragLen >= TUNING.FLICK_DEADZONE) {
          const speed = Phaser.Math.Clamp(
            dragLen * TUNING.FLICK_SENSITIVITY,
            TUNING.MIN_LAUNCH_SPEED,
            TUNING.MAX_LAUNCH_SPEED,
          )
          // Unit direction vector * speed = velocity (px/s).
          const dirX = dragX / dragLen
          const dirY = dragY / dragLen
          // Spawn at where the drag STARTED (the tap point), not the player.
          this.fireProjectile(this.dragStart.x, this.dragStart.y, dirX * speed, dirY * speed)
        }
      }

      this.mode = 'none'
      this.dragStart = null
    })
  }

  // Aim line: from the tap point, in the flick direction, length ~ strength.
  private drawAim(dragX: number, dragY: number) {
    this.aimLine.clear()
    if (!this.dragStart) return
    const len = Math.hypot(dragX, dragY)
    if (len < TUNING.FLICK_DEADZONE) return
    const dirX = dragX / len
    const dirY = dragY / len
    const drawLen = Math.min(len, 260)
    this.aimLine.lineStyle(4, 0x66aaff, 0.8)
    this.aimLine.beginPath()
    this.aimLine.moveTo(this.dragStart.x, this.dragStart.y)
    this.aimLine.lineTo(this.dragStart.x + dirX * drawLen, this.dragStart.y + dirY * drawLen)
    this.aimLine.strokePath()
  }

  private fireProjectile(x: number, y: number, vx: number, vy: number) {
    const gfx = this.add.circle(x, y, TUNING.PROJECTILE_RADIUS, 0x66aaff)
    this.projectiles.push({
      pos: new Phaser.Math.Vector2(x, y),
      vel: new Phaser.Math.Vector2(vx, vy),
      radius: TUNING.PROJECTILE_RADIUS,
      gfx,
      dead: false,
    })
  }

  private spawnDebris() {
    // Spawn at a random x along the top, falling straight down.
    const x = Phaser.Math.Between(TUNING.DEBRIS_RADIUS, DESIGN_WIDTH - TUNING.DEBRIS_RADIUS)
    const y = -TUNING.DEBRIS_RADIUS
    const gfx = this.add.circle(x, y, TUNING.DEBRIS_RADIUS, 0xff5555)
    this.debris.push({
      pos: new Phaser.Math.Vector2(x, y),
      vel: new Phaser.Math.Vector2(0, TUNING.DEBRIS_FALL_SPEED),
      radius: TUNING.DEBRIS_RADIUS,
      gfx,
      dead: false,
    })
  }

  // ==========================================================================
  // MAIN LOOP. `delta` = ms since last frame; -> seconds for px/s constants.
  // ==========================================================================
  update(_time: number, delta: number) {
    if (this.gameOver) return
    const dt = delta / 1000

    // NOTE: debris/enemies disabled for now. Re-enable spawn + collision below.
    // this.spawnTimer += delta
    // if (this.spawnTimer >= TUNING.DEBRIS_SPAWN_INTERVAL_MS) {
    //   this.spawnTimer -= TUNING.DEBRIS_SPAWN_INTERVAL_MS
    //   this.spawnDebris()
    // }

    // Integrate projectiles (straight line, no gravity). Kill off-screen.
    for (const p of this.projectiles) {
      p.pos.x += p.vel.x * dt
      p.pos.y += p.vel.y * dt
      p.gfx.setPosition(p.pos.x, p.pos.y)
      if (p.pos.y < -50 || p.pos.x < -50 || p.pos.x > DESIGN_WIDTH + 50) p.dead = true
    }

    // Integrate debris (falling down).
    for (const d of this.debris) {
      d.pos.x += d.vel.x * dt
      d.pos.y += d.vel.y * dt
      d.gfx.setPosition(d.pos.x, d.pos.y)

      // Hit player?
      if (
        Phaser.Math.Distance.Between(d.pos.x, d.pos.y, this.playerX, this.playerY) <
        TUNING.PLAYER_RADIUS + d.radius
      ) {
        this.triggerGameOver()
        return
      }
      // Reached bottom off-screen = missed (despawn, no penalty for proto).
      if (d.pos.y > DESIGN_HEIGHT + 50) d.dead = true
    }

    // Collisions: projectile vs debris (sum-of-radii circle test).
    for (const proj of this.projectiles) {
      if (proj.dead) continue
      for (const deb of this.debris) {
        if (deb.dead) continue
        if (proj.pos.distance(deb.pos) < proj.radius + deb.radius) {
          proj.dead = true
          deb.dead = true
          this.score++
        }
      }
    }

    this.projectiles = this.reap(this.projectiles)
    this.debris = this.reap(this.debris)

    this.hud.setText(`SCORE ${this.score}`)
  }

  private reap(list: Body[]): Body[] {
    const alive: Body[] = []
    for (const b of list) {
      if (b.dead) b.gfx.destroy()
      else alive.push(b)
    }
    return alive
  }

  private triggerGameOver() {
    this.gameOver = true
    this.player.setFillStyle(0xff0000)
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

    this.input.once('pointerdown', () => {
      this.children.getByName('gameover-text')?.destroy()
    })
  }
}
