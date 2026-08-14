import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useProfileSectionsStore } from '@/stores/profileSections'
import { sectionsApi, type ProfileSection } from '@/api/sections'

vi.mock('@/api/sections', () => ({
  sectionsApi: {
    mine: vi.fn(),
    upsert: vi.fn(),
    remove: vi.fn(),
    reorder: vi.fn(),
    syncTags: vi.fn(),
    syncSocialLinks: vi.fn(),
    tagSuggestions: vi.fn(),
    socialLinks: vi.fn(),
  },
}))

function section(overrides: Partial<ProfileSection> = {}): ProfileSection {
  return {
    id: 1,
    kind: 'books',
    slug: '',
    title: 'Kitoblar',
    position: 0,
    source: 'payload',
    items: [{ title: 'Dune' }],
    text: null,
    ...overrides,
  }
}

function listResponse(sections: ProfileSection[]) {
  return { data: { data: sections } }
}

describe('profile sections store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(sectionsApi.mine).mockReset()
    vi.mocked(sectionsApi.upsert).mockReset()
    vi.mocked(sectionsApi.remove).mockReset()
    vi.mocked(sectionsApi.syncTags).mockReset()
    vi.mocked(sectionsApi.syncSocialLinks).mockReset()
  })

  it('loads sections', async () => {
    vi.mocked(sectionsApi.mine).mockResolvedValue(listResponse([section()]) as never)

    const store = useProfileSectionsStore()
    await store.fetch()

    expect(store.sections).toHaveLength(1)
    expect(store.loaded).toBe(true)
  })

  it('reports a load failure rather than showing an empty profile', async () => {
    vi.mocked(sectionsApi.mine).mockRejectedValue(new Error('network'))

    const store = useProfileSectionsStore()
    await store.fetch()

    expect(store.loaded).toBe(false)
    expect(store.error).not.toBe('')
  })

  /**
   * The server deletes a section when its contents go, so a locally merged
   * copy would keep rendering something that no longer exists.
   */
  it('refetches after a save instead of patching in place', async () => {
    vi.mocked(sectionsApi.upsert).mockResolvedValue({ data: { data: section() } } as never)
    vi.mocked(sectionsApi.mine).mockResolvedValue(listResponse([]) as never)

    const store = useProfileSectionsStore()
    const ok = await store.save({ kind: 'books', payload: { items: [] } })

    expect(ok).toBe(true)
    expect(sectionsApi.mine).toHaveBeenCalled()
    expect(store.sections).toHaveLength(0)
  })

  /**
   * A refused save carries the reason — a capped list, an invalid handle — and
   * that reason is the whole message. Replacing it with something generic
   * leaves the user unable to fix what they typed.
   */
  it('surfaces the server validation message', async () => {
    vi.mocked(sectionsApi.upsert).mockRejectedValue({
      response: { data: { errors: { 'payload.items': ["Ko'pi bilan 50 ta"] } } },
    })

    const store = useProfileSectionsStore()
    const ok = await store.save({ kind: 'books', payload: { items: [] } })

    expect(ok).toBe(false)
    expect(store.error).toBe("Ko'pi bilan 50 ta")
  })

  it('falls back to the message when there are no field errors', async () => {
    vi.mocked(sectionsApi.upsert).mockRejectedValue({
      response: { data: { message: 'Nimadir xato' } },
    })

    const store = useProfileSectionsStore()
    await store.save({ kind: 'books', payload: { items: [] } })

    expect(store.error).toBe('Nimadir xato')
  })

  it('finds a section by kind and slug', async () => {
    vi.mocked(sectionsApi.mine).mockResolvedValue(
      listResponse([
        section({ id: 1, kind: 'custom', slug: 'cats', title: 'Cats' }),
        section({ id: 2, kind: 'custom', slug: 'plants', title: 'Plants' }),
      ]) as never,
    )

    const store = useProfileSectionsStore()
    await store.fetch()

    expect(store.find('custom', 'plants')?.id).toBe(2)
    expect(store.find('books')).toBeUndefined()
  })

  it('refetches after syncing tags and links', async () => {
    vi.mocked(sectionsApi.syncTags).mockResolvedValue({ data: { data: [] } } as never)
    vi.mocked(sectionsApi.syncSocialLinks).mockResolvedValue({ data: { data: [] } } as never)
    vi.mocked(sectionsApi.mine).mockResolvedValue(listResponse([]) as never)

    const store = useProfileSectionsStore()

    expect(await store.saveTags('skill', [{ name: 'Design' }])).toBe(true)
    expect(await store.saveSocialLinks([{ platform: 'telegram', value: 'aziz' }])).toBe(true)
    expect(sectionsApi.mine).toHaveBeenCalledTimes(2)
  })
})
