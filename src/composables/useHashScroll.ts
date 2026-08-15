import { nextTick } from 'vue'
import { useRoute } from 'vue-router'

/**
 * Scroll to the route's `#fragment`, once the screen actually has one.
 *
 * The router cannot do this. Its `scrollBehavior` runs as the navigation
 * resolves, which on every screen worth linking into is before the data has
 * arrived and therefore before the anchor exists — and a scroll that finds no
 * element is a silent no-op, indistinguishable from a dead link. The only
 * component that knows when the target is on the page is the one that renders
 * it, so the call belongs there.
 *
 * Used by /profile/edit#username, which Settings → Account links to.
 *
 * @param timeout give up rather than poll forever on a hash nothing will render
 */
export function useHashScroll(timeout = 2000) {
  const route = useRoute()

  /** Call once the screen's data is in place. */
  async function scrollToHash() {
    if (!route.hash) return

    await nextTick()

    const started = Date.now()

    const attempt = () => {
      const el = document.querySelector(route.hash)

      if (el) {
        // Instant, not smooth. A smooth scroll started while the page is still
        // settling gets cancelled by the next layout shift, and the user lands
        // back at the top — the exact failure this composable exists to fix.
        // Arriving at an anchor is navigation, not animation.
        el.scrollIntoView({ behavior: 'auto', block: 'start' })

        return
      }

      if (Date.now() - started < timeout) requestAnimationFrame(attempt)
    }

    attempt()
  }

  return { scrollToHash }
}
