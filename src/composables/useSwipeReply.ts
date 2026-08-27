import { computed, onBeforeUnmount, ref } from 'vue'

/**
 * Drag a message sideways to reply to it.
 *
 * ## One gesture, two very different input devices
 *
 * A finger and a mouse both produce pointer events, but they do not produce the
 * same *kind* of movement, and treating them identically breaks one of them:
 *
 *   touch   The competing gesture is scrolling the thread, which is vertical.
 *           A small horizontal slop is safe, because a reader who meant to
 *           scroll has already moved vertically by the time they have moved
 *           12px sideways.
 *   mouse   The competing gesture is SELECTING TEXT, which is horizontal — the
 *           same axis as this one. So a mouse needs a much larger slop and a
 *           much stronger horizontal bias before this may claim the drag, and
 *           a selection that is already in progress blocks it outright. Word
 *           and line selection (double- and triple-click) are unaffected:
 *           neither is a drag.
 *
 * ## Why the axis is decided once and never revisited
 *
 * The alternative — re-deciding on every move — produces a gesture that flips
 * between scrolling and replying while the finger is still down, which feels
 * broken in a way people cannot describe. Once `locked` is true this owns the
 * pointer until it is released; once the gesture has been abandoned to a scroll
 * it stays abandoned until the finger comes up.
 *
 * This is also why `touch-action: pan-y` belongs on the element (see
 * `bindings`): it lets the browser keep vertical scrolling on its own
 * compositor thread — so the thread never stutters while this is deciding —
 * while guaranteeing horizontal movement is delivered here instead of being
 * swallowed by the page or by Safari's back-navigation gesture.
 *
 * ## Why the move and release listeners live on `window`
 *
 * 🔴 Found in browser QA, and it made the gesture look completely dead on a
 * mouse. Only `pointerdown` is bound to the message; everything after it is
 * bound to `window` for the life of the gesture.
 *
 * The reason is that the bubble is NARROW — a message column is at most 78% of
 * a phone and 65% of a laptop — so by the very first `pointermove` the cursor
 * has usually already left it, and that event hit-tests to the row behind it.
 * Events on a parent do not reach a child's listener, so a gesture bound to the
 * message heard its own first move and nothing else, forever.
 *
 * `setPointerCapture` is the textbook answer and cannot be used here: capture
 * has to be requested from inside a pointer event, and the only one this
 * element reliably receives is the `pointerdown` — at which point the gesture
 * has not been distinguished from a tap or a scroll yet, and capturing every
 * press would retarget the clicks that reaction badges depend on. Window
 * listeners have neither problem: they are attached on press, they see every
 * move wherever the cursor goes, and they are removed on release.
 */

/** How far the message must travel before releasing it sends a reply. */
const THRESHOLD = 56

/** Travel past the threshold is resisted, so the bubble cannot be flung away. */
const MAX_OFFSET = 84

/** Horizontal movement before this may claim the pointer, per device. */
const SLOP = { touch: 12, mouse: 32 }

/** How much more horizontal than vertical the movement must be, per device. */
const DOMINANCE = { touch: 1.2, mouse: 2 }

/** Vertical movement that gives the pointer up to the scroller. */
const VERTICAL_ABANDON = 10

export interface SwipeReplyOptions {
  /** False for a message that cannot be replied to — an unsent or failed one. */
  enabled: () => boolean
  /** Called once, on release, when the gesture passed the threshold. */
  onReply: () => void
  /**
   * Called as soon as this claims the pointer, so the host can abandon whatever
   * else it had started — a long-press timer, in practice.
   */
  onClaim?: () => void
}

export function useSwipeReply(options: SwipeReplyOptions) {
  /** Current horizontal displacement, in pixels. Signed: negative is leftward. */
  const offset = ref(0)

  /** True while this owns the pointer — drives the "no transition" state. */
  const dragging = ref(false)

  /** 0..1 towards the threshold. Drives the reply icon's fade and scale. */
  const progress = computed(() => Math.min(1, Math.abs(offset.value) / THRESHOLD))

  /** True once far enough that releasing would reply. Drives the icon's fill. */
  const armed = computed(() => Math.abs(offset.value) >= THRESHOLD)

  /**
   * Which side the reply icon belongs on.
   *
   * The message moves away from one edge and towards the other; the icon sits
   * in the space the message has just vacated, which is the only place it can
   * go without being covered by the thing it belongs to.
   */
  const iconSide = computed<'left' | 'right' | null>(() => {
    if (offset.value === 0) return null

    return offset.value < 0 ? 'right' : 'left'
  })

  let start: { x: number; y: number; id: number; touch: boolean } | null = null
  let locked = false
  let abandoned = false
  let buzzed = false

  /**
   * True for a moment after a drag, so the click that follows is swallowed.
   *
   * A pointer sequence that moved still ends in a `click` on whatever was under
   * it. Without this, dragging a bubble that happens to contain a reaction
   * badge or a reply quote would fire that badge's handler on release — the
   * user would reply AND toggle a reaction with one gesture.
   */
  const swallowClick = ref(false)

  function reset() {
    // Defensive: a press arriving while a previous gesture's listeners are
    // somehow still attached must not end up with two of each.
    unlisten()
    start = null
    locked = false
    abandoned = false
    buzzed = false
    dragging.value = false
    document.body.style.removeProperty('user-select')
  }

  /**
   * Displacement, resisted past the threshold.
   *
   * Linear travel up to the point where the gesture would fire, then a third of
   * it: the resistance is the feedback that says "this is as far as it goes",
   * and it is what stops a fast flick from throwing the bubble across a 375px
   * screen and over its neighbours.
   */
  function resist(dx: number): number {
    const magnitude = Math.abs(dx)
    const travelled = magnitude <= THRESHOLD ? magnitude : THRESHOLD + (magnitude - THRESHOLD) * 0.3

    return Math.sign(dx) * Math.min(travelled, MAX_OFFSET)
  }

  /**
   * Is this press the start of dragging text that is ALREADY selected?
   *
   * 🔴 Found in browser QA. The first version of this asked only "does a
   * selection exist anywhere", and refused the gesture if one did. That is not
   * how a mouse works: pressing down outside a selection *collapses* it, so
   * every drag after any selection anywhere on the page — including one left
   * over from a previous gesture, in a different message — was silently
   * refused. The gesture appeared to work once and then stop.
   *
   * The case actually worth protecting is narrow: the press lands INSIDE live
   * selected text, which in every OS means "pick this text up and drag it".
   * Hit-testing the point against the selection's own rectangles is what tells
   * the two apart.
   */
  function pressIsOnSelectedText(event: PointerEvent): boolean {
    const selection = document.getSelection()

    if (!selection || selection.isCollapsed || selection.rangeCount === 0) return false

    for (let index = 0; index < selection.rangeCount; index += 1) {
      for (const rect of selection.getRangeAt(index).getClientRects()) {
        if (
          event.clientX >= rect.left &&
          event.clientX <= rect.right &&
          event.clientY >= rect.top &&
          event.clientY <= rect.bottom
        ) {
          return true
        }
      }
    }

    return false
  }

  /**
   * Bound and unbound with the gesture rather than for the component's life.
   *
   * A conversation is hundreds of bubbles; hundreds of idle window listeners
   * that each run on every mouse move is a cost paid continuously for something
   * that happens on a deliberate press. Non-passive because the move handler
   * calls `preventDefault()` once it owns the gesture.
   */
  function listen() {
    window.addEventListener('pointermove', onPointerMove, { passive: false })
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerCancel)
  }

  function unlisten() {
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerUp)
    window.removeEventListener('pointercancel', onPointerCancel)
  }

  function onPointerDown(event: PointerEvent) {
    reset()

    if (!options.enabled()) return

    // Secondary and middle buttons open menus and paste; neither is a drag.
    if (event.pointerType === 'mouse' && event.button !== 0) return
    if (event.pointerType === 'mouse' && pressIsOnSelectedText(event)) return

    start = {
      x: event.clientX,
      y: event.clientY,
      id: event.pointerId,
      touch: event.pointerType !== 'mouse',
    }

    listen()
  }

  function onPointerMove(event: PointerEvent) {
    if (!start || abandoned || event.pointerId !== start.id) return

    const dx = event.clientX - start.x
    const dy = event.clientY - start.y

    if (!locked) {
      // The reader is scrolling. Give up for the rest of this pointer's life —
      // re-deciding mid-gesture is what makes a swipe feel like it is fighting
      // the person doing it.
      if (Math.abs(dy) > VERTICAL_ABANDON && Math.abs(dy) >= Math.abs(dx)) {
        abandoned = true

        return
      }

      const kind = start.touch ? 'touch' : 'mouse'

      if (Math.abs(dx) < SLOP[kind] || Math.abs(dx) <= Math.abs(dy) * DOMINANCE[kind]) return

      locked = true
      dragging.value = true
      swallowClick.value = true
      options.onClaim?.()

      // A mouse drag over text starts a selection before we know it is a
      // gesture. Drop whatever was selected within the slop and stop the
      // browser extending it while the bubble moves.
      if (!start.touch) {
        document.getSelection()?.removeAllRanges()
        document.body.style.setProperty('user-select', 'none')
      }
    }

    // Owned: nothing else may interpret this movement.
    if (event.cancelable) event.preventDefault()

    offset.value = resist(dx)

    if (armed.value && !buzzed) {
      buzzed = true
      // The gesture has passed the point where it will fire. Saying so while
      // the finger is still down is what makes the threshold discoverable.
      navigator.vibrate?.(12)
    } else if (!armed.value) {
      buzzed = false
    }
  }

  function onPointerUp(event: PointerEvent) {
    if (!start || event.pointerId !== start.id) return

    const fired = locked && armed.value

    unlisten()

    // Zeroing the offset while `dragging` is false is what plays the spring
    // back to place — the transition is bound to the negation of `dragging`.
    offset.value = 0
    reset()

    if (fired) options.onReply()

    // One frame is enough: the synthetic click follows the pointerup
    // immediately, and holding the flag longer would swallow a real tap.
    if (swallowClick.value) {
      requestAnimationFrame(() => {
        swallowClick.value = false
      })
    }
  }

  function onPointerCancel(event: PointerEvent) {
    if (start && event.pointerId !== start.id) return

    unlisten()
    offset.value = 0
    reset()
    swallowClick.value = false
  }

  /** Capture phase, so it runs before any handler inside the bubble. */
  function onClickCapture(event: MouseEvent) {
    if (!swallowClick.value) return

    event.stopPropagation()
    event.preventDefault()
  }

  // A component destroyed mid-gesture — the thread navigating away under a held
  // finger — must not leave three window listeners and a frozen body behind.
  onBeforeUnmount(() => {
    unlisten()
    document.body.style.removeProperty('user-select')
  })

  return {
    offset,
    dragging,
    progress,
    armed,
    iconSide,
    /**
     * Spread onto the element the gesture is made on.
     *
     * Only the press is bound here. Move and release arrive on `window` for the
     * duration of the gesture — see the note at the top of this file for why
     * binding them to the message made the gesture die after its first move.
     */
    bindings: {
      onPointerdown: onPointerDown,
      onClickCapture,
      // Vertical scrolling stays with the browser; horizontal comes here.
      style: { touchAction: 'pan-y' },
    },
  }
}

export const SWIPE_REPLY_THRESHOLD = THRESHOLD
