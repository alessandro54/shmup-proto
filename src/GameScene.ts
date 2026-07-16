import Phaser from 'phaser'
import { DESIGN_WIDTH, DESIGN_HEIGHT, TUNING } from './config'
import type { Body, Bullet, Enemy, Explosion, EnemyType, Projectile, Star } from './types'
import { reap } from './physics'
import { launchShot, updateProjectiles, detonate } from './projectile'
import { SHOT_NORMAL, SHOT_HOMING, SHOT_SPLIT, type ShotType } from './weapon'
import { updateShards } from './shard'
import { updateExplosions } from './explosion'
import { spawnEnemy, updateEnemies, updateEnemyBullets, collideProjectiles } from './enemy'
import { spawnStar, updateStars } from './star'
import { STAGES } from './waves'

// Re-export so main.ts keeps importing the design resolution from here.
export { DESIGN_WIDTH, DESIGN_HEIGHT }

export class GameScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Arc
  private aura!: Phaser.GameObjects.Arc // glows around the player while homing is armed
  private playerPos = new Phaser.Math.Vector2(DESIGN_WIDTH / 2, TUNING.PLAYER_Y)

  private projectiles: Projectile[] = []
  private shards: Body[] = []
  private enemies: Enemy[] = []
  private enemyBullets: Bullet[] = []
  private explosions: Explosion[] = []
  private stars: Star[] = []

  // Wave/stage progression + star quota.
  private stageIndex = 0
  private waveIndex = -1 // -1 = no wave spawned yet
  private stageComplete = false
  private waveStars = 0 // stars collected toward the current wave's quota
  private waveTarget = 0 // stars needed to advance (loops the wave if unmet)
  private transitionTimer = 0 // >0 = between-wave pause in progress
  private transitionText?: Phaser.GameObjects.Text
  private starBar!: Phaser.GameObjects.Rectangle

  // Input state. Multi-touch: one finger moves the player, whichever finger
  // DRAGS is the shot, and a HELD extra finger (or Shift) makes it homing.
  // Each active pointer records its down position + time.
  private downInfo = new Map<number, { x: number; y: number; t: number }>()
  private movePointerId: number | null = null
  private shiftKey?: Phaser.Input.Keyboard.Key // desktop homing modifier

  // Active weapon: every swipe fires this. Tap a weapon button to toggle it on
  // (tap again = back to normal). SHOT_NORMAL = the default.
  private weapon: ShotType = SHOT_NORMAL
  private weaponBtns: { shot: ShotType; rect: Phaser.Geom.Rectangle; box: Phaser.GameObjects.Rectangle }[] = []
  private chargeRing!: Phaser.GameObjects.Arc // multi hold-to-charge feedback

  // Homing energy (drains per homing shot, recharges over time + on kills).
  private energy = TUNING.HOMING_ENERGY_MAX
  private energyBar!: Phaser.GameObjects.Rectangle

  private gameOver = false
  private hud!: Phaser.GameObjects.Text

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
    // Homing-armed aura: a ring around the player, shown only while a homing
    // modifier is held (extra finger / Shift) and energy is available.
    this.aura = this.add
      .circle(0, 0, TUNING.PLAYER_RADIUS + 14, TUNING.COLOR_HOMING, 0.15)
      .setStrokeStyle(4, TUNING.COLOR_HOMING, 0.9)
      .setVisible(false)
    this.chargeRing = this.add.circle(0, 0, 20).setStrokeStyle(5, TUNING.COLOR_SPLIT, 0.9).setFillStyle().setVisible(false).setDepth(50)
    this.hud = this.add
      .text(24, 24, '', { fontFamily: 'monospace', fontSize: '32px', color: '#888888' })
      .setDepth(100)

    this.buildWeaponUi()

    // Enable a couple extra touch pointers (default is 1): move + swipe at once.
    this.input.addPointer(2)
    this.shiftKey = this.input.keyboard?.addKey('SHIFT') // desktop homing modifier

    this.setupInput()
    this.resetState()
  }

  // --------------------------------------------------------------------------
  // State lifecycle
  // --------------------------------------------------------------------------
  private resetState() {
    for (const list of [this.projectiles, this.shards, this.enemies, this.enemyBullets, this.explosions, this.stars]) {
      list.forEach((o) => o.gfx.destroy())
    }
    this.projectiles = []
    this.shards = []
    this.enemies = []
    this.enemyBullets = []
    this.explosions = []
    this.stars = []
    this.stageIndex = 0
    this.waveIndex = -1
    this.stageComplete = false
    this.waveStars = 0
    this.transitionTimer = 0
    this.transitionText?.destroy()
    this.transitionText = undefined
    this.energy = TUNING.HOMING_ENERGY_MAX
    this.gameOver = false
    this.downInfo.clear()
    this.movePointerId = null
    this.weapon = SHOT_NORMAL
    if (this.weaponBtns.length) this.refreshWeaponButtons()
    this.playerPos.set(DESIGN_WIDTH / 2, TUNING.PLAYER_Y)
    this.player.setPosition(this.playerPos.x, this.playerPos.y).setFillStyle(TUNING.COLOR_PLAYER)

    this.advanceWave() // spawn the first wave
  }

  // Right-side energy bar + left-side star-quota bar.
  private buildWeaponUi() {
    const barH = 400
    // Energy bar on the right edge (grows up from the bottom).
    const ex = DESIGN_WIDTH - 44
    const ey = DESIGN_HEIGHT - barH - 24
    this.add.rectangle(ex, ey, 24, barH, TUNING.COLOR_ENERGY_BG).setOrigin(0, 0).setDepth(100)
    this.energyBar = this.add
      .rectangle(ex, ey + barH, 24, barH, TUNING.COLOR_ENERGY)
      .setOrigin(0, 1)
      .setDepth(101)

    // Star-quota bar on the LEFT edge (fills as you collect stars this wave).
    const sx = 20
    const sy = DESIGN_HEIGHT - barH - 24
    this.add.rectangle(sx, sy, 24, barH, TUNING.COLOR_STAR_BAR_BG).setOrigin(0, 0).setDepth(100)
    this.starBar = this.add.rectangle(sx, sy + barH, 24, barH, TUNING.COLOR_STAR_BAR).setOrigin(0, 1).setDepth(101)

    // Two weapon-select buttons, centered along the bottom.
    const bw = 120
    const bh = 90
    const gap = 30
    const by = DESIGN_HEIGHT - bh - 20
    const cx = DESIGN_WIDTH / 2
    this.addWeaponButton(SHOT_HOMING, cx - bw - gap / 2, by, bw, bh, 'target')
    this.addWeaponButton(SHOT_SPLIT, cx + gap / 2, by, bw, bh, 'dots')
    this.refreshWeaponButtons()
  }

  private addWeaponButton(shot: ShotType, x: number, y: number, w: number, h: number, icon: 'target' | 'dots') {
    const box = this.add.rectangle(x, y, w, h, TUNING.COLOR_UI_OFF).setOrigin(0, 0).setDepth(100).setStrokeStyle(3, 0x666666)
    const ix = x + w / 2
    const iy = y + h / 2
    if (icon === 'target') {
      this.add.circle(ix, iy, 20).setStrokeStyle(4, shot.color).setDepth(101)
      this.add.circle(ix, iy, 6, shot.color).setDepth(101)
    } else {
      for (const dx of [-18, 0, 18]) this.add.circle(ix + dx, iy, 7, shot.color).setDepth(101)
    }
    this.weaponBtns.push({ shot, rect: new Phaser.Geom.Rectangle(x, y, w, h), box })
  }

  // Toggle a weapon: tapping the active one turns it off (back to normal).
  private toggleWeapon(shot: ShotType) {
    this.weapon = this.weapon === shot ? SHOT_NORMAL : shot
    this.refreshWeaponButtons()
  }

  private refreshWeaponButtons() {
    for (const b of this.weaponBtns) {
      const on = b.shot === this.weapon
      b.box.setFillStyle(on ? TUNING.COLOR_UI_ON : TUNING.COLOR_UI_OFF, on ? 0.25 : 1)
      b.box.setStrokeStyle(3, on ? TUNING.COLOR_UI_SELECTED : 0x666666)
    }
  }

  // Move to the next wave: reset the star quota and spawn it. Called at start
  // and once the current wave is cleared WITH its quota met.
  private advanceWave() {
    this.clearEnemies()
    this.waveStars = 0
    const stage = STAGES[this.stageIndex]
    this.waveIndex++
    if (this.waveIndex >= stage.length) {
      this.stageComplete = true
      this.showBanner('STAGE CLEAR')
      return
    }
    this.spawnCurrentWave()
  }

  // Wave cleared with quota met: sweep all in-flight debris, flash a banner,
  // and start the between-wave pause. The next wave spawns when it elapses.
  private startWaveTransition() {
    for (const list of [this.projectiles, this.shards, this.enemyBullets]) {
      list.forEach((o) => o.gfx.destroy())
    }
    this.projectiles = []
    this.shards = []
    this.enemyBullets = []
    this.clearEnemies() // any leftover shields
    this.transitionText = this.add
      .text(DESIGN_WIDTH / 2, DESIGN_HEIGHT / 2, 'WAVE CLEARED', {
        fontFamily: 'monospace',
        fontSize: '44px',
        color: '#ffffff',
      })
      .setOrigin(0.5)
      .setDepth(200)
    this.transitionTimer = TUNING.WAVE_TRANSITION_S
  }

  // Re-run the current wave (enemies cleared but the star quota wasn't met).
  // Collected stars carry over, so each loop chips at the target.
  private loopWave() {
    this.clearEnemies()
    this.spawnCurrentWave()
  }

  private clearEnemies() {
    this.enemies.forEach((e) => e.gfx.destroy())
    this.enemies = []
  }

  // Spawn the current wave's enemies and set its star quota = the total star
  // value of all killable enemies in it (you must catch essentially all stars).
  private spawnCurrentWave() {
    const wave = STAGES[this.stageIndex][this.waveIndex]
    let target = 0
    for (const s of wave) {
      spawnEnemy(this, this.enemies, s.type, s.x, s.y)
      if (!s.type.invincible) target += s.type.points
    }
    this.waveTarget = target
  }

  // --------------------------------------------------------------------------
  // Input
  // --------------------------------------------------------------------------
  private setupInput() {
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.gameOver) return this.resetState()
      // A tap on a weapon button toggles it (and does nothing else).
      const btn = this.weaponBtns.find((b) => b.rect.contains(p.x, p.y))
      if (btn) return this.toggleWeapon(btn.shot)

      this.downInfo.set(p.id, { x: p.x, y: p.y, t: this.time.now })
      // A touch on/near the player claims the MOVE role (one finger).
      const grabbed =
        Phaser.Math.Distance.Between(p.x, p.y, this.playerPos.x, this.playerPos.y) <= TUNING.PLAYER_GRAB_DIST
      if (grabbed && this.movePointerId === null) this.movePointerId = p.id
    })

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (this.gameOver) return
      if (p.id === this.movePointerId) this.movePlayerTo(p.x, p.y)
    })

    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      const info = this.downInfo.get(p.id)
      this.downInfo.delete(p.id)
      const wasMove = p.id === this.movePointerId
      if (wasMove) this.movePointerId = null
      if (!info || this.gameOver) return

      const dragX = p.x - info.x
      const dragY = p.y - info.y
      const dist = Math.hypot(dragX, dragY)
      const dur = this.time.now - info.t

      // A tap (short + barely moved) does nothing on its own — it may be the
      // held modifier finger for a homing swipe.
      if (dur <= TUNING.TAP_MAX_MS && dist <= TUNING.TAP_MAX_DIST) return

      // A real swipe: fires only if it didn't move the char and started below.
      if (dist >= TUNING.FLICK_DEADZONE && !wasMove && info.y >= TUNING.ACTIVE_ZONE_Y) {
        // Held modifier: another finger still down (not the move finger), or
        // Shift on desktop.
        const modifier =
          !!this.shiftKey?.isDown || [...this.downInfo.keys()].some((id) => id !== this.movePointerId)
        this.fireSwipe(info.x, info.y, dragX, dragY, dur >= TUNING.HOLD_MS, modifier)
      }
    })
  }

  // Swipe fires based on the active weapon:
  //   HOMING active + a held modifier finger → homing shot (costs energy)
  //   MULTI active + held swipe             → charged 3-fan
  //   otherwise                             → single normal shot
  private fireSwipe(ox: number, oy: number, dragX: number, dragY: number, held: boolean, modifier: boolean) {
    let shot = SHOT_NORMAL
    if (this.weapon === SHOT_HOMING && modifier && this.energy >= TUNING.HOMING_COST) shot = SHOT_HOMING
    else if (this.weapon === SHOT_SPLIT && held) shot = SHOT_SPLIT

    const fired = launchShot(this, this.projectiles, new Phaser.Math.Vector2(ox, oy), dragX, dragY, shot)
    if (fired > 0 && shot.homing) this.energy -= TUNING.HOMING_COST
  }

  // Charge ring: only for the MULTI weapon, while a swipe finger is held. Fills
  // over HOLD_MS; brightens to white when the 3-fan is ready.
  private updateChargeRing() {
    let cand: { x: number; y: number; t: number } | null = null
    if (this.weapon === SHOT_SPLIT) {
      for (const [id, info] of this.downInfo) {
        if (id === this.movePointerId || info.y < TUNING.ACTIVE_ZONE_Y) continue
        if (!cand || info.t > cand.t) cand = info
      }
    }
    if (!cand) {
      this.chargeRing.setVisible(false)
      return
    }
    const fill = Phaser.Math.Clamp((this.time.now - cand.t) / TUNING.HOLD_MS, 0, 1)
    this.chargeRing
      .setVisible(true)
      .setPosition(cand.x, cand.y)
      .setRadius(16 + fill * 26)
      .setStrokeStyle(5, fill >= 1 ? 0xffffff : TUNING.COLOR_SPLIT, 0.4 + 0.5 * fill)
  }

  // Move the player, clamped to the bottom-half zone.
  private movePlayerTo(x: number, y: number) {
    this.playerPos.set(
      Phaser.Math.Clamp(x, TUNING.PLAYER_RADIUS, DESIGN_WIDTH - TUNING.PLAYER_RADIUS),
      Phaser.Math.Clamp(y, TUNING.ACTIVE_ZONE_Y + TUNING.PLAYER_RADIUS, DESIGN_HEIGHT - TUNING.PLAYER_RADIUS),
    )
    this.player.setPosition(this.playerPos.x, this.playerPos.y)
  }

  // ==========================================================================
  // MAIN LOOP. `delta` = ms since last frame; -> seconds for px/s constants.
  // ==========================================================================
  update(_time: number, delta: number) {
    if (this.gameOver) return
    const dt = delta / 1000

    // Between-wave transition: world is paused, debris already cleared. Count
    // down, then spawn the next wave.
    if (this.transitionTimer > 0) {
      this.transitionTimer -= dt
      if (this.transitionTimer <= 0) {
        this.transitionText?.destroy()
        this.transitionText = undefined
        this.advanceWave()
      }
      return
    }

    // Recharge homing energy over time.
    if (this.energy < TUNING.HOMING_ENERGY_MAX) {
      this.energy = Math.min(TUNING.HOMING_ENERGY_MAX, this.energy + dt / TUNING.HOMING_RECHARGE_S)
    }
    this.energyBar.setScale(1, this.energy / TUNING.HOMING_ENERGY_MAX)

    // Homing-armed aura: follow the player, show only while armed.
    // Aura shows the active special weapon (colored to match), hidden on normal.
    const special = this.weapon !== SHOT_NORMAL
    this.aura.setPosition(this.playerPos.x, this.playerPos.y).setVisible(special)
    if (special) this.aura.setStrokeStyle(4, this.weapon.color, 0.9)
    this.updateChargeRing()

    updateProjectiles(this, this.projectiles, this.enemies, this.shards, this.explosions, dt)
    updateExplosions(this.explosions, dt)

    // Projectiles kill enemies on contact (detonate + drop a star on kill).
    const hit = collideProjectiles(
      this.projectiles,
      this.enemies,
      (x, y) => detonate(this, this.shards, this.explosions, x, y, TUNING.SHARD_RINGS),
      (type: EnemyType, x, y) => spawnEnemy(this, this.enemies, type, x, y),
      (x, y, value) => spawnStar(this, this.stars, x, y, value),
    )
    // Kills refund homing energy: normal kills a little, homing kills a full shot.
    const refund =
      hit.normalKills * TUNING.HOMING_KILL_RECHARGE + hit.homingKills * TUNING.HOMING_SELF_RECHARGE
    if (refund > 0) {
      this.energy = Math.min(TUNING.HOMING_ENERGY_MAX, this.energy + refund)
    }

    // Stars fall; catch them to fill the wave quota, or lose them off the bottom.
    this.waveStars += updateStars(this.stars, dt, this.playerPos, TUNING.PLAYER_RADIUS)
    this.starBar.setScale(1, this.waveTarget > 0 ? Math.min(1, this.waveStars / this.waveTarget) : 1)

    // Enemies fire at the player; the boss also dashes — contact = game over.
    if (updateEnemies(this, this.enemies, dt, this.playerPos, TUNING.PLAYER_RADIUS, this.enemyBullets)) {
      return this.triggerGameOver()
    }

    // Enemy bullets + your own shards can both kill the player.
    if (updateEnemyBullets(this.enemyBullets, dt, this.playerPos, TUNING.PLAYER_RADIUS)) {
      return this.triggerGameOver()
    }
    if (updateShards(this.shards, dt, this.playerPos, TUNING.PLAYER_RADIUS)) {
      return this.triggerGameOver()
    }

    this.projectiles = reap(this.projectiles)
    this.shards = reap(this.shards)
    this.enemies = reap(this.enemies)
    this.enemyBullets = reap(this.enemyBullets)
    this.explosions = reap(this.explosions)
    this.stars = reap(this.stars)

    // Wave logic: once all killable enemies are dead AND every star has settled
    // (caught or lost), either advance (quota met) or LOOP the wave (quota unmet).
    const killableLeft = this.enemies.some((e) => !e.type.invincible)
    if (!this.stageComplete && !killableLeft && this.stars.length === 0) {
      if (this.waveStars >= this.waveTarget) this.startWaveTransition()
      else this.loopWave()
    }

    this.hud.setText(`WAVE ${this.waveIndex + 1}   ★ ${Math.floor(this.waveStars)}/${this.waveTarget}`)
  }

  private triggerGameOver() {
    this.gameOver = true
    this.player.setFillStyle(TUNING.COLOR_PLAYER_DEAD)
    this.showBanner('GAME OVER\ntap to restart')
  }

  // Centered text banner (game over, stage clear). Auto-clears on next tap.
  private showBanner(text: string) {
    this.add
      .text(DESIGN_WIDTH / 2, DESIGN_HEIGHT / 2, text, {
        fontFamily: 'monospace',
        fontSize: '48px',
        color: '#ffffff',
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(200)
      .setName('banner-text')

    this.input.once('pointerdown', () => this.children.getByName('banner-text')?.destroy())
  }
}
