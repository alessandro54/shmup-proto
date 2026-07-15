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
  FLICK_SENSITIVITY: 6, // launch speed (px/s) per px of drag
  MIN_LAUNCH_SPEED: 500,
  MAX_LAUNCH_SPEED: 1800,
  FLICK_DEADZONE: 18, // min drag px before a flick counts
  AIM_LINE_MAX: 260, // visual cap on the aim line length

  // --- Projectiles (fly straight, no gravity) ---
  PROJECTILE_RADIUS: 10,
  // Lifetime scales with launch speed: MIN_LAUNCH_SPEED -> LIFE_MIN seconds,
  // MAX_LAUNCH_SPEED -> LIFE_MAX. More force = longer life = flies further.
  LIFE_MIN: 0.35,
  LIFE_MAX: 1.6,

  // --- Explosion ring flash (shown when a shot detonates) ---
  EXPLOSION_RADIUS: 90, // final ring radius (px)
  EXPLOSION_DURATION: 0.35, // seconds to grow + fade out

  // --- Shards (debris flung out when a shot detonates) ---
  SHARD_RINGS: 3, // concentric rings per burst (1-4)
  SHARD_COUNT: 14, // fragments PER ring (evenly spaced around a circle)
  SHARD_RADIUS: 6,
  SHARD_SPEED: 380, // outward speed (px/s) of the FASTEST (outermost) ring
  // Each inner ring travels at this fraction of the previous ring's speed.
  // 0.6 => ring speeds 380, 228, 137, ... Lower = tighter nesting.
  SHARD_RING_SPEED_RATIO: 0.6,

  // --- Debris / enemies (fall from top toward bottom; currently disabled) ---
  DEBRIS_RADIUS: 20,
  DEBRIS_SPAWN_INTERVAL_MS: 900, // lower = more debris
  DEBRIS_FALL_SPEED: 140, // downward speed (px/s)

  // --- Colors ---
  COLOR_PLAYER: 0xdddddd,
  COLOR_PLAYER_DEAD: 0xff0000,
  COLOR_PROJECTILE: 0x66aaff,
  COLOR_SHARD: 0xffcc66,
  COLOR_DEBRIS: 0xff5555,
  COLOR_EXPLOSION: 0xffaa33,
  COLOR_ACCENT: 0x66aaff,
}
