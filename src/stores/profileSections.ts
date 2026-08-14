import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  sectionsApi,
  type ProfileSection,
  type SectionKind,
  type SocialLink,
  type TagItem,
  type TagType,
  type UpsertSectionPayload,
} from '@/api/sections'
import { interestsApi } from '@/api/interests'

/**
 * The owner's own sections.
 *
 * Reads are refetched rather than patched in place after a write: the server
 * decides whether a section survives at all — clearing its contents deletes it
 * — so a locally merged copy would keep rendering a section the server has
 * already dropped.
 */
export const useProfileSectionsStore = defineStore('profileSections', () => {
  const sections = ref<ProfileSection[]>([])
  const loaded = ref(false)
  const loading = ref(false)
  const saving = ref(false)
  const error = ref('')

  async function fetch() {
    loading.value = true
    error.value = ''
    try {
      const { data } = await sectionsApi.mine()
      sections.value = data.data
      loaded.value = true
    } catch {
      error.value = "Bo'limlarni yuklab bo'lmadi."
    } finally {
      loading.value = false
    }
  }

  function find(kind: SectionKind, slug = ''): ProfileSection | undefined {
    return sections.value.find((s) => s.kind === kind && s.slug === slug)
  }

  async function save(payload: UpsertSectionPayload) {
    saving.value = true
    error.value = ''
    try {
      await sectionsApi.upsert(payload)
      await fetch()
      return true
    } catch (e) {
      error.value = messageFor(e)
      return false
    } finally {
      saving.value = false
    }
  }

  async function remove(section: ProfileSection) {
    saving.value = true
    try {
      await sectionsApi.remove(section.id)
      await fetch()
    } catch (e) {
      error.value = messageFor(e)
    } finally {
      saving.value = false
    }
  }

  async function saveTags(type: TagType, tags: TagItem[]) {
    saving.value = true
    error.value = ''
    try {
      await sectionsApi.syncTags(type, tags)
      await fetch()
      return true
    } catch (e) {
      error.value = messageFor(e)
      return false
    } finally {
      saving.value = false
    }
  }

  async function saveInterests(ids: number[]) {
    saving.value = true
    error.value = ''
    try {
      await interestsApi.sync(ids)
      await fetch()
      return true
    } catch (e) {
      error.value = messageFor(e)
      return false
    } finally {
      saving.value = false
    }
  }

  async function saveSocialLinks(links: SocialLink[]) {
    saving.value = true
    error.value = ''
    try {
      await sectionsApi.syncSocialLinks(links)
      await fetch()
      return true
    } catch (e) {
      error.value = messageFor(e)
      return false
    } finally {
      saving.value = false
    }
  }

  /**
   * Validation failures carry the reason the save was refused — a capped list,
   * an invalid handle — and that reason is the whole message. Swallowing it
   * for a generic "something went wrong" leaves the user with no way to fix
   * what they typed.
   */
  function messageFor(e: unknown): string {
    const response = (e as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } })
      .response

    const firstError = Object.values(response?.data?.errors ?? {})[0]?.[0]

    return firstError ?? response?.data?.message ?? "Saqlab bo'lmadi."
  }

  function reset() {
    sections.value = []
    loaded.value = false
    loading.value = false
    saving.value = false
    error.value = ''
  }

  return { sections, loaded, loading, saving, error, fetch, find, save, remove, saveTags, saveInterests, saveSocialLinks, reset }
})
