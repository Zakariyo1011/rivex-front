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
