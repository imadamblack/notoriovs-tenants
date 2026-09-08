// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'

vi.mock('cookies-next', () => ({ getCookie: () => undefined }))

const { default: getTrackingData } = await import('@/services/tracking-cookies')

describe('getTrackingData', () => {
  // El quiz dejó de leer los UTM con `useSearchParams` —ese hook sacaba el
  // formulario del HTML prerrenderizado— y ahora le pasa un URLSearchParams
  // armado desde `window.location.search`. Ambos exponen `.get`, pero solo
  // un test deja constancia de que el cambio de tipo no rompió la captura.
  it('lee los UTM de un URLSearchParams, no solo del hook de Next', () => {
    const params = new URLSearchParams(
      '?utm_source=meta&utm_medium=cpc&utm_campaign=julio&otro=ignorame',
    )

    expect(getTrackingData(params).utm).toEqual({
      utm_source: 'meta',
      utm_medium: 'cpc',
      utm_campaign: 'julio',
    })
  })

  it('una URL sin UTM no inventa campos', () => {
    expect(getTrackingData(new URLSearchParams('')).utm).toEqual({})
  })
})
