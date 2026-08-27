import { describe, it, expect } from 'vitest'
import { messagePreviewText } from '@/lib/messagePreview'

/**
 * The one-line summary used everywhere a message is quoted rather than shown.
 *
 * 🔴 The bug behind it: every quote interpolated `body` directly, which is right
 * for text and empty for everything else — so answering a picture produced a
 * reply bar containing a name and a blank line.
 */
describe('messagePreviewText', () => {
  it('uses the body of a text message', () => {
    expect(messagePreviewText({ body: 'Salom', type: 'text' })).toBe('Salom')
  })

  it('labels a picture rather than rendering its empty body', () => {
    expect(messagePreviewText({ body: '', type: 'image' })).toBe('Rasm')
  })

  it('prefers a caption over the generic label when a picture has one', () => {
    expect(messagePreviewText({ body: 'Bugungi rasm', type: 'image' })).toBe('Bugungi rasm')
  })

  /** A reply outlives the message it answered — a state reached in normal use. */
  it('says the original is gone rather than returning nothing', () => {
    expect(
      messagePreviewText({ id: null, deleted: true, body: null, type: null, sender: null }),
    ).toBe("Xabar o'chirilgan")
  })

  it('falls back to a generic label for a message with nothing to show', () => {
    expect(messagePreviewText({ body: '   ', type: 'text' })).toBe('Xabar')
  })

  it('is empty for nothing at all, so a caller can test it', () => {
    expect(messagePreviewText(null)).toBe('')
    expect(messagePreviewText(undefined)).toBe('')
  })
})
