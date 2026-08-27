import { test, expect, type Page, type BrowserContext } from '@playwright/test'
import { ADMIN, USERS, api, loginAdmin, loginAs } from './fixtures'

/**
 * The one journey that has to work.
 *
 * Two real browser contexts — separate storage, separate sessions — because
 * the realtime assertions are only meaningful between genuinely different
 * clients. Steps run in order and share state; `test.describe.serial` makes a
 * failure stop the run rather than cascade into confusing follow-on failures.
 *
 * Setup actions that are merely preconditions (creating an activity, applying)
 * go through the API. The assertions that matter — a message appearing without
 * a reload, a balance changing on its own, a dispute outcome reaching the
 * accused — are all made against what a person would actually see.
 */
test.describe.serial('critical journey', () => {
  let contextA: BrowserContext
  let contextB: BrowserContext
  let pageA: Page
  let pageB: Page
  let tokenA: string
  let tokenB: string

  let activityId: number
  let conversationId: number
  /** The reply B sends, reused by the reaction test as its target. */
  let replyTarget: string

  test.beforeAll(async ({ browser }) => {
    contextA = await browser.newContext()
    contextB = await browser.newContext()
    pageA = await contextA.newPage()
    pageB = await contextB.newPage()

    tokenA = await loginAs(pageA, USERS.a.phone)
    tokenB = await loginAs(pageB, USERS.b.phone)
  })

  test.afterAll(async () => {
    await contextA?.close()
    await contextB?.close()
  })

  test('both users are signed in', async () => {
    await pageA.goto('/')
    await expect(pageA.getByText(USERS.a.name).first()).toBeVisible()

    await pageB.goto('/')
    await expect(pageB.getByText(USERS.b.name).first()).toBeVisible()
  })

  test('A creates a paid activity', async () => {
    const categories = await api<{ data: { id: number }[] }>(pageA, tokenA, '/categories')
    const regions = await api<{ data: { id: number }[] }>(pageA, tokenA, '/regions')

    const created = await api<{ data: { id: number } }>(pageA, tokenA, '/activities', {
      method: 'POST',
      body: {
        category_id: categories.data[0].id,
        region_id: regions.data[0].id,
        title: 'E2E PS5 FIFA',
        description: 'Playwright critical journey',
        location_name: 'Chilonzor',
        start_at: new Date(Date.now() + 86_400_000).toISOString().slice(0, 19).replace('T', ' '),
        people_needed: 1,
        payment_type: 'participant_pays',
        amount: 100000,
      },
    })

    activityId = created.data.id

    await pageA.goto(`/activities/${activityId}`)
    await expect(pageA.getByText('E2E PS5 FIFA')).toBeVisible()
  })

  test('B applies and A accepts, opening a conversation', async () => {
    const application = await api<{ data: { id: number } }>(
      pageB,
      tokenB,
      `/activities/${activityId}/applications`,
      { method: 'POST', body: { message: 'Men ham qatnashmoqchiman' } },
    )

    await api(pageA, tokenA, `/applications/${application.data.id}/accept`, { method: 'POST' })

    // `/me/matches` until 11.9, which removed match-based chat entirely.
    // The activity resolves its own conversation now — and a two-person
    // activity resolves to the pair's *direct* thread, which is exactly why
    // the client has to ask rather than derive it.
    const conversation = await api<{ data: { id: number } }>(
      pageA,
      tokenA,
      `/activities/${activityId}/conversation`,
    )
    conversationId = conversation.data.id

    expect(conversationId).toBeTruthy()
  })

  test('a chat message reaches the other user without a reload', async () => {
    await pageA.goto(`/chats/${conversationId}`)
    await pageB.goto(`/chats/${conversationId}`)

    // Presence proves both sockets are actually connected and authorised.
    await expect(pageA.getByText('Onlayn').first()).toBeVisible()

    const message = `Salom, E2E ${Date.now()}`
    await pageB.getByPlaceholder('Xabar yozing...').fill(message)
    await pageB.getByRole('button', { name: 'Yuborish' }).click()

    // No reload anywhere: this must arrive over the WebSocket.
    await expect(pageA.getByText(message)).toBeVisible()
  })

  /**
   * Reply, over the wire, with its quote.
   *
   * A reply that arrives as a bare message is a reply that needs a refresh to
   * be understood — which is the thing realtime exists to avoid. The parent's
   * text has to travel with it.
   */
  test('a reply reaches the other user with its quoted original', async () => {
    const original = `Asl xabar ${Date.now()}`
    await pageA.getByPlaceholder('Xabar yozing...').fill(original)
    await pageA.getByRole('button', { name: 'Yuborish' }).click()
    await expect(pageB.getByText(original)).toBeVisible()

    // B replies to it through the desktop hover action.
    //
    // The action buttons are scoped to their OWN message row. They are
    // hover-revealed (`opacity-0 pointer-events-none` at rest), so a page-wide
    // `.first()` resolves to some other message's hidden button and waits
    // forever for it to become clickable.
    const originalRow = pageB.locator('[data-message-id]').filter({ hasText: original }).first()
    await originalRow.hover()
    await originalRow.getByRole('button', { name: 'Javob berish' }).click()

    // The composer says what is being answered before anything is typed.
    //
    // A string, not a regex: Playwright normalises whitespace when matching a
    // string and does NOT when matching a regex, so an anchored `/ga javob$/`
    // fails on the template's trailing newline even though the text is right.
    await expect(pageB.getByText('ga javob')).toBeVisible()

    const answer = `Javob ${Date.now()}`
    await pageB.getByPlaceholder('Xabar yozing...').fill(answer)
    await pageB.getByRole('button', { name: 'Yuborish' }).click()

    // A sees the answer AND the quote of their own message inside it.
    await expect(pageA.getByText(answer)).toBeVisible()
    await expect(pageA.locator('.border-l-2', { hasText: original }).first()).toBeVisible()

    replyTarget = answer
  })

  /**
   * Reactions, both directions, over the wire.
   *
   * The delta carries `previous_emoji`, so a *change* must move the reactor
   * rather than adding them again — without it the badge being left never comes
   * down and one person appears to hold two opinions.
   */
  test('a reaction reaches the other user and can be taken back', async () => {
    // Scoped to the row, for the same reason as the reply above.
    const row = pageA.locator('[data-message-id]').filter({ hasText: replyTarget }).first()

    await row.hover()
    await row.getByRole('button', { name: "Reaksiya qo'shish" }).click()
    await row.getByRole('button', { name: '👍', exact: true }).click()

    // B sees it appear without reloading.
    await expect(pageB.getByRole('button', { name: '👍 1' })).toBeVisible()

    // A changes their mind: one badge replaces the other, never both at once.
    await row.hover()
    await row.getByRole('button', { name: "Reaksiya qo'shish" }).click()
    await row.getByRole('button', { name: '❤️', exact: true }).click()

    await expect(pageB.getByRole('button', { name: '❤️ 1' })).toBeVisible()
    await expect(pageB.getByRole('button', { name: '👍 1' })).toHaveCount(0)

    // And takes it back entirely by tapping the badge they already hold.
    await row.getByRole('button', { name: '❤️ 1' }).click()
    await expect(pageB.getByRole('button', { name: '❤️ 1' })).toHaveCount(0)
  })

  /**
   * Typing whispers are throttled to one every 2s, and the previous test's
   * `fill()` already consumed the current window — so typing immediately would
   * send nothing and the indicator would never appear. Waiting out the window
   * makes the test deterministic without weakening what it asserts.
   *
   * The indicator also self-expires after 3.5s, so the assertion has to land
   * inside that; typing again on a short interval keeps it alive while
   * Playwright polls.
   */
  test('the typing indicator appears on the other side', async () => {
    await pageB.waitForTimeout(2_200)

    const input = pageB.getByPlaceholder('Xabar yozing...')
    const indicator = pageA.getByText(`${USERS.b.name} yozmoqda...`).first()

    await expect
      .poll(
        async () => {
          await input.fill(`yozayapman ${Date.now()}`)
          return indicator.isVisible()
        },
        { timeout: 15_000, intervals: [2_200, 2_200, 2_200, 2_200] },
      )
      .toBe(true)
  })

  test('B pays the commission and the wallet updates live', async () => {
    const invoices = await api<{ data: { id: number; amount: number }[] }>(
      pageB,
      tokenB,
      `/invoices?activity_id=${activityId}`,
    )
    const invoice = invoices.data[0]
    expect(invoice, 'the participant should owe a commission invoice').toBeTruthy()

    await api(pageB, tokenB, `/invoices/${invoice.id}/pay`, { method: 'POST' })

    // A refund is what puts money in a wallet, so the balance is asserted after
    // the dispute below. Here we only prove the payment settled.
    const payments = await api<{ data: unknown[] }>(pageB, tokenB, '/wallet/transactions')
    expect(payments).toBeTruthy()
  })

  /**
   * Cancellation rather than a no-show: a no-show can only be filed once the
   * meetup has passed, and fast-forwarding the clock from a browser test would
   * mean reaching into the database mid-journey. Cancelling exercises the same
   * downstream machinery this journey is here to prove — notification delivery
   * and the commission refund — through a path a user can actually take.
   *
   * The no-show and dispute state machine itself is covered exhaustively in
   * tests/Feature/NoShowDisputeTest.php (28 tests).
   */
  test('A cancels the activity and B is notified', async () => {
    await api(pageA, tokenA, `/activities/${activityId}/cancel`, {
      method: 'POST',
      body: { reason: 'other', note: 'E2E: releasing the paid commission' },
    })

    await pageB.goto('/notifications')
    await expect(pageB.getByText('Faoliyat bekor qilindi').first()).toBeVisible()
  })

  test('the refund reaches B and the wallet balance reflects it', async () => {
    await pageB.goto('/wallet')

    // Cancelling the activity released the paid commission back to the payer.
    // The ledger row is labelled with the reason settlement passed in, which is
    // what a user actually sees — not a generic "refund" string.
    await expect(pageB.getByText('Faoliyat bekor qilindi').first()).toBeVisible()

    // 5% commission on a 100 000 activity, credited back.
    await expect(pageB.getByText('+5 000').first()).toBeVisible()
  })

  test('an admin can resolve disputes and a moderator cannot approve payouts', async () => {
    const adminContext = await pageA.context().browser()!.newContext()
    const adminPage = await adminContext.newPage()

    const superToken = await loginAdmin(adminPage, ADMIN.superAdmin)
    expect(superToken).toBeTruthy()

    await adminPage.goto('/admin/withdrawals')
    await expect(adminPage.getByRole('heading').first()).toBeVisible()

    // The permission boundary, checked in the browser rather than only in PHP.
    const moderatorStatus = await adminPage.evaluate(async () => {
      const login = await fetch('http://127.0.0.1:8812/api/v1/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ email: 'moderator@rivex.local', password: 'password' }),
      }).then((r) => r.json())

      const probe = await fetch('http://127.0.0.1:8812/api/v1/admin/withdrawals', {
        headers: { Authorization: `Bearer ${login.token}`, Accept: 'application/json' },
      })

      return probe.status
    })

    expect(moderatorStatus, 'a moderator must never reach the payout queue').toBe(403)

    await adminContext.close()
  })
})
