// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Recuperación de contraseña e invitaciones (issue 10). Lo que se prueba aquí
// es una sola cosa, y es de las tres que esta suite cubre: qué token abre qué
// Tenant, y a quién se le manda un correo.
//
// El resto del flujo —que el enlace se vea bien, que el correo llegue— se
// verifica usando la app. Lo que no se ve a simple vista es que un token
// legítimo del cliente A no sirva en el subdominio del cliente B, o que
// pedir recuperación para un correo ajeno no mande nada.

const find = vi.fn()
const count = vi.fn()
const create = vi.fn()
const forgotPassword = vi.fn()
const resetPassword = vi.fn()
const dbFindOne = vi.fn()
const sendTenantEmail = vi.fn()

const payload = {
  find,
  count,
  create,
  forgotPassword,
  resetPassword,
  db: { findOne: dbFindOne },
  logger: { error: vi.fn(), warn: vi.fn() },
}

vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('payload', () => ({ getPayload: async () => payload }))
vi.mock('@/email/tenantEmails', () => ({
  sendTenantEmail: (...args: unknown[]) => sendTenantEmail(...args),
  passwordResetEmail: (companyName: string, url: string, hours: number) => ({
    subject: 'reset',
    text: url,
    html: url,
    hours,
    companyName,
  }),
  invitationEmail: (companyName: string, url: string, days: number) => ({
    subject: 'invite',
    text: url,
    html: url,
    days,
    companyName,
  }),
}))

const {
  requestPasswordReset,
  resetPasswordWithToken,
  inviteTenantUser,
  INVITATION_TTL_MS,
  RESET_TOKEN_TTL_MS,
  MIN_PASSWORD_LENGTH,
} = await import('@/utils/tenantUserAccount')

const ACME = { id: 1, subdomain: 'acme', companyName: 'Acme' }

beforeEach(() => {
  vi.clearAllMocks()
  find.mockResolvedValue({ docs: [] })
  count.mockResolvedValue({ totalDocs: 0 })
  forgotPassword.mockResolvedValue('tok-123')
  sendTenantEmail.mockResolvedValue(true)
})

describe('recuperación de contraseña', () => {
  // El caso que hace del endpoint un directorio de correos si se responde
  // distinto: aquí se comprueba el otro lado, que tampoco SALGA un correo.
  it('un correo que no existe no genera token ni correo', async () => {
    await requestPasswordReset(ACME, 'nadie@acme.com')

    expect(forgotPassword).not.toHaveBeenCalled()
    expect(sendTenantEmail).not.toHaveBeenCalled()
  })

  // El email es único a nivel global en la colección, así que la búsqueda va
  // acotada al Tenant del host: la cuenta homónima de otro cliente no recibe
  // nada, y quien pide desde este subdominio no descubre que existe.
  it('la búsqueda del usuario va acotada al tenant del host', async () => {
    await requestPasswordReset(ACME, 'Cliente@Acme.com')

    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'tenant-users',
        where: { and: [{ email: { equals: 'cliente@acme.com' } }, { tenant: { equals: 1 } }] },
      }),
    )
  })

  it('un correo que sí existe recibe el enlace en el subdominio de su tenant', async () => {
    find.mockResolvedValue({ docs: [{ id: 7 }] })

    await requestPasswordReset(ACME, 'cliente@acme.com')

    expect(forgotPassword).toHaveBeenCalledWith(
      expect.objectContaining({ disableEmail: true, expiration: RESET_TOKEN_TTL_MS }),
    )
    const [, { to, email }] = sendTenantEmail.mock.calls[0]
    expect(to).toBe('cliente@acme.com')
    expect(email.text).toContain('//acme.')
    expect(email.text).toContain('token=tok-123')
  })
})

describe('canje del enlace', () => {
  it('un token de otro tenant no canjea, ni cambia contraseña alguna', async () => {
    dbFindOne.mockResolvedValue({ id: 9, tenant: 2 })

    const outcome = await resetPasswordWithToken({ id: 1 }, 'tok-de-otro', 'contraseña-larga')

    expect(outcome).toEqual({ ok: false, reason: 'invalid-token' })
    expect(resetPassword).not.toHaveBeenCalled()
  })

  // Un enlace vencido o ya usado no encuentra dueño: Payload deja la
  // expiración en "ahora" al canjear.
  it('un token que ya no existe no canjea', async () => {
    dbFindOne.mockResolvedValue(null)

    expect(await resetPasswordWithToken({ id: 1 }, 'tok-viejo', 'contraseña-larga')).toEqual({
      ok: false,
      reason: 'invalid-token',
    })
    expect(resetPassword).not.toHaveBeenCalled()
  })

  it('una contraseña corta se rechaza antes de tocar la base', async () => {
    expect(await resetPasswordWithToken({ id: 1 }, 'tok-123', 'a'.repeat(MIN_PASSWORD_LENGTH - 1))).toEqual({
      ok: false,
      reason: 'weak-password',
    })
    expect(dbFindOne).not.toHaveBeenCalled()
  })

  it('un token de este tenant canjea y devuelve la sesión con su rol', async () => {
    dbFindOne.mockResolvedValue({ id: 7, tenant: 1 })
    resetPassword.mockResolvedValue({
      token: 'jwt-nuevo',
      user: { id: 7, email: 'cliente@acme.com', tenant: 1, role: 'owner' },
    })

    const outcome = await resetPasswordWithToken({ id: 1 }, 'tok-123', 'contraseña-larga')

    expect(outcome).toEqual({
      ok: true,
      login: {
        token: 'jwt-nuevo',
        session: { id: 7, email: 'cliente@acme.com', tenantId: 1, role: 'owner' },
      },
    })
  })
})

describe('invitaciones', () => {
  it('el invitado se crea en el tenant del host y recibe su enlace', async () => {
    create.mockResolvedValue({ id: 8, role: 'member' })

    const outcome = await inviteTenantUser(ACME, 'Nuevo@Acme.com ', 'member')

    expect(outcome).toEqual({ ok: true, user: { id: 8, email: 'nuevo@acme.com', role: 'member' } })
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'tenant-users',
        data: expect.objectContaining({ email: 'nuevo@acme.com', role: 'member', tenant: 1 }),
      }),
    )
    expect(forgotPassword).toHaveBeenCalledWith(
      expect.objectContaining({ expiration: INVITATION_TTL_MS, disableEmail: true }),
    )
    const [, { to }] = sendTenantEmail.mock.calls[0]
    expect(to).toBe('nuevo@acme.com')
  })

  // La contraseña con la que nace la cuenta no la conoce nadie: solo el token
  // del correo la abre.
  it('el invitado nace con una contraseña aleatoria que no se comunica', async () => {
    create.mockResolvedValue({ id: 8, role: 'member' })

    await inviteTenantUser(ACME, 'nuevo@acme.com', 'member')

    const { password } = create.mock.calls[0][0].data
    expect(typeof password).toBe('string')
    expect(password.length).toBeGreaterThanOrEqual(32)
    expect(JSON.stringify(sendTenantEmail.mock.calls[0])).not.toContain(password)
  })

  it('un correo que ya tiene cuenta no se vuelve a dar de alta', async () => {
    count.mockResolvedValue({ totalDocs: 1 })

    expect(await inviteTenantUser(ACME, 'cliente@acme.com', 'owner')).toEqual({
      ok: false,
      reason: 'already-exists',
    })
    expect(create).not.toHaveBeenCalled()
  })
})
