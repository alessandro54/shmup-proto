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
export const TUNING = {
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
  // Speed is nearly constant — a long swipe is only slightly faster.
  FLICK_SENSITIVITY: 6, // launch speed (px/s) per px of drag
  MIN_LAUNCH_SPEED: 950,
  MAX_LAUNCH_SPEED: 1200,
  FLICK_DEADZONE: 18, // min drag px before a swipe counts
  // A press counts as a TAP (not a swipe) if it's short + barely moved — taps
  // jitter on touch, so this tolerance must be generous.
  TAP_MAX_DIST: 40,
  TAP_MAX_MS: 250,
  DOUBLE_TAP_MS: 320, // max gap between taps to count as a double-tap (homing)

  // --- Hold-to-split (the 3-shot fan) ---
  // Holding the press this long (ms) before releasing fires a 3-shot FAN.
  // Split shots are weak but each BOUNCES off a wall once before bursting.
  HOLD_MS: 220,
  TRIPLE_SPREAD_DEG: 16, // half-angle between fan shots (center ± this)
  SPLIT_DAMAGE: 0.3, // each split (fan) shot's damage
  SPLIT_BOUNCES: 1, // wall bounces a split shot gets before it bursts
  SPLIT_BOUNCE_DAMP: 0.6, // velocity kept after a bounce (slower rebound)
  // A bounced shot that drops back below the middle without hitting anything
  // fades out over this long instead of returning to the player.
  PROJECTILE_FADE_TIME: 0.25,

  // --- Projectiles (fly straight, no gravity) ---
  PROJECTILE_RADIUS: 10,
  // A shot flies straight in the swipe direction at constant speed and bursts
  // when it reaches the top edge (or a side edge while in the top zone), or on
  // hitting an enemy. Force = speed only. No deceleration, no fall-back.
  SHOT_LIFE_FAILSAFE: 8, // seconds; reaps a stray shot that never bursts

  // --- Explosion ring flash (shown when a shot detonates) ---
  EXPLOSION_RADIUS: 90, // final ring radius (px)
  EXPLOSION_DURATION: 0.35, // seconds to grow + fade out

  // --- Weapons ---
  NORMAL_DAMAGE: 2, // damage a normal shot deals to an enemy
  HOMING_DAMAGE: 0.66, // homing shot: weaker, but steers onto targets
  // Homing is deliberately imperfect: lazy turn, limited seek range, wobbly aim,
  // and it never dives — if it overshoots an enemy it keeps climbing to the top.
  HOMING_TURN: 3.5, // steer rate (rad/s) — lower = lazier, less accurate
  HOMING_SEEK_RADIUS: 340, // only targets enemies within this distance
  HOMING_JITTER_DEG: 14, // random aim wobble each frame (degrees)
  HOMING_MIN_CLIMB: 0.2, // fraction of speed kept as upward velocity (never dives)
  HOMING_ENERGY_MAX: 5, // homing shots available when the bar is full
  HOMING_COST: 1, // energy drained per homing shot
  HOMING_RECHARGE_S: 7, // seconds to passively recharge 1 energy (slow)
  HOMING_KILL_RECHARGE: 0.5, // energy per enemy killed with a NORMAL shot
  HOMING_SELF_RECHARGE: 1, // energy per enemy killed with a HOMING shot (refills the shot)

  // --- Stars (BBM-style reward drops) ---
  // A killed enemy drops a star worth its `points`. Stars FALL; catch one by
  // touching it with the player, or lose it off the bottom. Fill the wave's
  // star quota to advance — otherwise the wave loops.
  STAR_FALL_SPEED: 230, // px/s
  STAR_MIN_RADIUS: 12,
  STAR_RADIUS_PER_VALUE: 5, // radius grows with value (bigger star = more worth)
  // Magnet: within this distance of the player, a star is pulled toward it.
  STAR_MAGNET_RADIUS: 150,
  STAR_MAGNET_SPEED: 520, // px/s pull toward the player when in range

  // --- Shards (debris flung out when a shot detonates) ---
  SHARD_RINGS: 3, // concentric rings per KILL burst (1-4)
  SHARD_MISS_RINGS: 2, // rings for a MISSED shot's burst (fewer debris)
  SHARD_COUNT: 14, // fragments PER ring (evenly spaced around a circle)
  SHARD_RADIUS: 6,
  SHARD_SPEED: 380, // outward speed (px/s) of the FASTEST (outermost) ring
  // Each inner ring travels at this fraction of the previous ring's speed.
  // 0.6 => ring speeds 380, 228, 137, ... Lower = tighter nesting.
  SHARD_RING_SPEED_RATIO: 0.6,

  // --- Enemies ---
  // Enemies are spawned by WAVES (see waves.ts) and PERSIST until killed. They
  // move within the top zone and stop at ENEMY_FLOOR_FRAC of the way down it
  // (0 = top edge, 1 = the middle divider) — so fallers halt partway, not at
  // the middle.
  ENEMY_FLOOR_FRAC: 0.72,
  ENEMY_WEAVE_AMP: 90, // sine horizontal amplitude (px) for weaver
  ENEMY_WEAVE_FREQ: 3, // sine frequency (rad/s) for weaver
  DRIFT_SWEEP_FREQ: 1.2, // drifter L↔R sweep frequency (rad/s)
  ORBIT_RADIUS: 110, // circle radius (px) for orbiter
  ORBIT_FREQ: 1.6, // orbit angular speed (rad/s)
  ENEMY_SPLIT_COUNT: 2, // children a splitter spawns on death
  ENEMY_FLASH_TIME: 0.08, // seconds an enemy flashes white after a non-lethal hit

  // --- Enemy attacks ---
  ENEMY_BULLET_RADIUS: 9,
  ENEMY_BULLET_SPEED: 340, // px/s, aimed at the player at fire time
  STATIC_FIRE_INTERVAL: 1.6, // seconds between static-enemy shots

  // --- Colors ---
  COLOR_PLAYER: 0xdddddd,
  COLOR_PLAYER_DEAD: 0xff0000,
  COLOR_PROJECTILE: 0x66aaff,
  COLOR_SHARD: 0xffcc66,
  COLOR_EXPLOSION: 0xffaa33,
  COLOR_ACCENT: 0x66aaff,
  COLOR_ENEMY_FLASH: 0xffffff, // hit flash tint
  COLOR_ENEMY_BULLET: 0xff3366,
  // Per enemy-type colors.
  COLOR_ENEMY_STATIC: 0x9b59b6,
  COLOR_ENEMY_DRIFTER: 0x3498db,
  COLOR_ENEMY_FALLER: 0xff5555,
  COLOR_ENEMY_WEAVER: 0x2ecc71,
  COLOR_ENEMY_SPLITTER: 0xe67e22,
  COLOR_ENEMY_ORBITER: 0x1abc9c,
  COLOR_ENEMY_SHIELD: 0x7f8c8d, // steel grey
  COLOR_HOMING: 0xff66cc, // homing projectile
  COLOR_SPLIT: 0x66ffcc, // split (fan) projectile
  COLOR_UI_ON: 0xff66cc, // selected weapon button
  COLOR_UI_OFF: 0x333333, // unselected weapon button
  COLOR_UI_SELECTED: 0xffffff, // selected weapon border
  COLOR_ENERGY: 0xff66cc, // energy bar fill
  COLOR_ENERGY_BG: 0x333333, // energy bar track
  COLOR_STAR: 0xffe066, // falling star
  COLOR_STAR_BAR: 0xffe066, // left star-quota bar fill
  COLOR_STAR_BAR_BG: 0x333333,
}
