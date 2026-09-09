// @vitest-environment node
// Este test habla con Postgres; jsdom no le aporta nada y además rompe el
// worker (html-encoding-sniffer no carga bajo require). El resto de los tests
// de integración ya declaraban `node` por lo mismo.
import { getPayload, Payload } from 'payload'
import config from '@/payload.config'

import { describe, it, beforeAll, afterAll, expect } from 'vitest'

let payload: Payload

// Contra una base de pruebas limpia no hay usuarios que encontrar, así que el
// test siembra el suyo y lo retira al final: pasar o fallar no puede depender
// de lo que alguien haya creado a mano.
const email = 'api-int@notoriovs.test'

describe('API', () => {
  beforeAll(async () => {
    const payloadConfig = await config
    payload = await getPayload({ config: payloadConfig })

    await payload.delete({ collection: 'users', where: { email: { equals: email } } })
    await payload.create({ collection: 'users', data: { email, password: 'test' } })
  })

  afterAll(async () => {
    await payload.delete({ collection: 'users', where: { email: { equals: email } } })
  })

  it('fetches users', async () => {
    const users = await payload.find({
      collection: 'users',
      where: { email: { equals: email } },
    })

    expect(users.docs).toHaveLength(1)
  })
})
