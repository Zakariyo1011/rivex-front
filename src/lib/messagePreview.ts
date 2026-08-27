import type { Message, MessageReplyPreview } from '@/types'

/**
 * One line describing a message, for the places a message is quoted rather than
 * shown: the composer's reply bar, the quote inside a reply bubble, and the
 * conversation list's last-message row.
 *
 * ## Why this is shared rather than inlined at each site
 *
 * All three used to interpolate `body` directly, which is right for a text
 * message and wrong for every other kind. A picture has no body, so the quote
 * rendered as an empty line — a reply bar containing a name and nothing else,
 * which reads as a bug rather than as "you are answering a photo". Three call
 * sites meant three chances to disagree about that, and they did.
 *
 * The fallbacks are deliberately nouns rather than sentences ("Rasm", not "Bu
 * xabarda rasm bor"): a quote is a label, and it sits on one truncated line.
 */

/** Shapes that can be summarised — the flattened reply preview or a whole message. */
type Quotable = Pick<Message, 'body' | 'type'> | MessageReplyPreview

export function messagePreviewText(source: Quotable | null | undefined): string {
  if (!source) return ''

  // A reply outlives the message it answered — the foreign key nulls rather
  // than cascading — so this is a state the UI reaches in normal use, not an
  // error. It has to say so; an empty quote says nothing.
  if ('deleted' in source && source.deleted) return "Xabar o'chirilgan"

  const body = source.body?.trim()
  if (body) return body

  if (source.type === 'image') return 'Rasm'

  // A message with neither a body nor a kind we recognise. Still needs a line,
  // because the alternative is a quote box with nothing in it.
  return 'Xabar'
}
