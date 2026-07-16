import Phaser from 'phaser'
import { GameScene, DESIGN_WIDTH, DESIGN_HEIGHT } from './GameScene'
import { runTutorialOnce } from './tutorial'

// Kill browser touch gestures at the document level too. The CSS handles most
// of it, but preventDefault on touchmove is the belt-and-suspenders that stops
// pull-to-refresh / rubber-band scroll on stubborn mobile browsers.
document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false })

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#111111',
  scale: {
    mode: Phaser.Scale.FIT, // letterbox-fit the design resolution
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: DESIGN_WIDTH, // portrait design resolution
    height: DESIGN_HEIGHT,
  },
  scene: [GameScene],
})

// First-visit tutorial (once, guarded by a cookie).
runTutorialOnce()
