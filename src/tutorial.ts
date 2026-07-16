import { driver } from 'driver.js'
import 'driver.js/dist/driver.css'

const COOKIE = 'gw_tutorial_seen'

function hasSeenTutorial(): boolean {
  return document.cookie.split('; ').some((c) => c.startsWith(`${COOKIE}=`))
}

function markTutorialSeen() {
  // Persist for a year.
  document.cookie = `${COOKIE}=1; max-age=${60 * 60 * 24 * 365}; path=/`
}

// Show the tutorial once (guarded by a cookie). The game runs on a canvas, so
// steps are centered popovers explaining the controls rather than DOM highlights.
export function runTutorialOnce() {
  if (hasSeenTutorial()) return
  markTutorialSeen() // mark immediately so it never reappears, even if skipped

  const tour = driver({
    showProgress: true,
    steps: [
      { popover: { title: 'Gravity Well', description: 'Quick tour — 20 seconds.' } },
      { popover: { title: 'Move', description: 'Drag your ship along the bottom half of the screen.' } },
      { popover: { title: 'Shoot', description: 'Swipe upward to fire. Shots fly up and burst at the top.' } },
      { popover: { title: 'Stars', description: 'Killed enemies drop stars. Catch them to fill the wave bar on the left.' } },
      {
        popover: {
          title: 'Weapons',
          description:
            'Tap a weapon button. HOMING: hold a second finger (or Shift) + swipe. MULTI: hold the swipe to charge a 3-shot fan.',
        },
      },
      { popover: { title: 'Waves', description: 'Clear every wave — the last one is a boss. Watch its dive!' } },
      { popover: { title: 'Go', description: 'Good luck.' } },
    ],
  })
  tour.drive()
}
