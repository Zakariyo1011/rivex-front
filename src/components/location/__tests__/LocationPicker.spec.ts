import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import LocationPicker from '@/components/location/LocationPicker.vue'

const regions = vi.fn()
const districts = vi.fn()

vi.mock('@/api/locations', () => ({
  locationsApi: {
    regions: () => regions(),
    districts: (id: number) => districts(id),
  },
}))

const request = vi.fn()
const geoState = { value: 'idle' as string }
const isDenied = { value: false }

vi.mock('@/composables/useGeolocation', () => ({
  useGeolocation: () => ({
    request,
    state: geoState,
    isDenied,
    coords: { value: null },
    hasCoords: { value: false },
    isAvailable: true,
    clear: vi.fn(),
  }),
}))

const FaStub = defineComponent({ setup: () => () => h('i') })

/**
 * Where an activity happens.
 *
 * The picker is the answer to two separate failures. Neither the create wizard
 * nor the edit form could ever set a coordinate, so `activities.latitude` was
 * null on every row in the database and the "near me" radius filter — which
 * requires it — could not match a single activity. And the two screens each
 * hand-rolled their own region and district selects, which is how they would
 * have drifted apart.
 *
 * These tests hold the two properties that matter: the cascade is correct, and
 * refusing location permission never blocks the form.
 */
function mountPicker(props: Record<string, unknown> = {}) {
  return mount(LocationPicker, {
    props: {
      regionId: null,
      districtId: null,
      locationName: '',
      latitude: null,
      longitude: null,
      ...props,
    },
    global: {
      stubs: { FontAwesomeIcon: FaStub },
    },
  })
}

describe('LocationPicker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    geoState.value = 'idle'
    isDenied.value = false

    regions.mockResolvedValue({
      data: { data: [{ id: 1, name: 'Toshkent shahri', code: 'UZ-TK' }] },
    })
    districts.mockResolvedValue({
      data: { data: [{ id: 5, region_id: 1, name: 'Chilonzor', code: 'UZ-TK-CHI' }] },
    })
  })

  it('loads regions once on mount and asks for no districts yet', async () => {
    mountPicker()
    await flushPromises()

    expect(regions).toHaveBeenCalledTimes(1)
    expect(districts).not.toHaveBeenCalled()
  })

  it('fetches the districts of the region that was chosen', async () => {
    const wrapper = mountPicker()
    await flushPromises()

    await wrapper.findAll('select')[0]!.setValue('1')
    await flushPromises()

    expect(districts).toHaveBeenCalledWith(1)
    expect(wrapper.emitted('update:regionId')?.[0]).toEqual([1])
  })

  /**
   * The old district belongs to the old region. Keeping it would fail the
   * server's district-belongs-to-region check with a message about a field the
   * user did not touch.
   */
  it('clears the district when the region changes', async () => {
    const wrapper = mountPicker({ regionId: 1, districtId: 5 })
    await flushPromises()

    await wrapper.findAll('select')[0]!.setValue('1')

    expect(wrapper.emitted('update:districtId')?.[0]).toEqual([null])
  })

  it('loads districts on mount when a region is already chosen', async () => {
    mountPicker({ regionId: 1 })
    await flushPromises()

    expect(districts).toHaveBeenCalledWith(1)
  })

  it('emits both halves of a coordinate together', async () => {
    request.mockResolvedValue({ lat: 41.3111, lng: 69.2797 })

    const wrapper = mountPicker()
    await flushPromises()

    const button = wrapper
      .findAll('button')
      .find((b) => b.text().includes('Hozirgi joylashuvimni'))!

    await button.trigger('click')
    await flushPromises()

    expect(wrapper.emitted('update:coordinates')?.[0]).toEqual([
      { latitude: 41.3111, longitude: 69.2797 },
    ])
  })

  it('shows a map preview and a way to remove the pin once one is set', async () => {
    const wrapper = mountPicker({ latitude: 41.3111, longitude: 69.2797 })
    await flushPromises()

    expect(wrapper.text()).toContain('Joy belgilandi')
    expect(wrapper.find('iframe').exists()).toBe(true)

    await wrapper.findAll('button').find((b) => b.text() === "O'chirish")!.trigger('click')

    expect(wrapper.emitted('update:coordinates')?.[0]).toEqual([null])
  })

  /**
   * Refusing permission is a normal outcome, not an error path. The picker says
   * so once and the region and district selects carry on working — an activity
   * is publishable without a pin, and always was.
   */
  it('keeps working when location permission is refused', async () => {
    request.mockResolvedValue(null)

    const wrapper = mountPicker()
    await flushPromises()

    isDenied.value = true
    geoState.value = 'denied'

    await wrapper
      .findAll('button')
      .find((b) => b.text().includes('Hozirgi joylashuvimni'))!
      .trigger('click')
    await flushPromises()

    expect(wrapper.emitted('update:coordinates')).toBeUndefined()
    expect(wrapper.text()).toContain('Joylashuvga ruxsat berilmagan')
    // The manual path is untouched: both selects are still there.
    expect(wrapper.findAll('select')).toHaveLength(2)
  })

  it('survives a region list that fails to load', async () => {
    regions.mockRejectedValue(new Error('offline'))

    const wrapper = mountPicker()
    await flushPromises()

    expect(wrapper.text()).toContain("Viloyatlar ro'yxatini yuklab bo'lmadi")
  })

  it('shows the reader what the location will say', async () => {
    const wrapper = mountPicker({ regionId: 1, districtId: 5, locationName: 'PS Arena' })
    await flushPromises()

    expect(wrapper.text()).toContain('PS Arena')
    expect(wrapper.text()).toContain('Chilonzor, Toshkent shahri')
  })

  it('surfaces server field errors beside the field they belong to', async () => {
    const wrapper = mountPicker({
      errors: { region_id: 'Viloyatni tanlang.', location_name: 'Joyni kiriting.' },
    })
    await flushPromises()

    expect(wrapper.text()).toContain('Viloyatni tanlang.')
    expect(wrapper.text()).toContain('Joyni kiriting.')
  })
})
