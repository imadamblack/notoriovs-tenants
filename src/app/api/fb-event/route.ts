import { cookies } from 'next/headers'
import { createHash } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getTenantBySubdomain } from '@/utils/getTenant'

type FbEventBody = {
  eventName: string
  eventID: string | number
  subdomain?: string
  user?: {
    em?: string
    ph?: string
    externalID?: string | number
  }
  clientData?: Record<string, unknown>
}

const hash = (value: string) => createHash('sha256').update(value).digest('hex')

// Reenvía el evento a la Conversions API de Meta usando el Pixel/token del
// tenant (colección Tenants -> tab Webhooks -> tracking.metaPixelId /
// tracking.metaCapiToken), en vez de las env vars globales PIXEL /
// FB_CAPI_TOKEN que usaba antes. Si el tenant no existe o no configuró su
// Pixel/token, el evento simplemente no se reenvía (no hay a dónde mandarlo).
export async function POST(request: NextRequest) {
  try {
    const body: FbEventBody = await request.json()
    const { eventName, eventID, subdomain, user, clientData } = body

    if (!subdomain) {
      return NextResponse.json({ skipped: true, reason: 'Falta subdomain' })
    }

    const tenant = await getTenantBySubdomain(subdomain)
    const pixelId = tenant?.tracking?.metaPixelId
    const capiToken = tenant?.tracking?.metaCapiToken

    if (!pixelId || !capiToken) {
      return NextResponse.json({
        skipped: true,
        reason: `Tenant "${subdomain}" no tiene Meta Pixel / Conversions API Token configurado`,
      })
    }

    const referer = request.headers.get('referer') || undefined
    const userAgent = request.headers.get('user-agent') || undefined
    const ip = request.headers.get('x-forwarded-for') || undefined

    const cookieStore = await cookies()
    const fbc = cookieStore.get('_fbc')?.value
    const fbp = cookieStore.get('_fbp')?.value

    const userData = {
      em: user?.em ? [hash(user.em)] : undefined,
      ph: user?.ph ? [hash(user.ph)] : undefined,
      external_id: user?.externalID ? hash(String(user.externalID)) : undefined,
      fbc,
      fbp,
      client_user_agent: userAgent,
      client_ip_address: ip,
    }

    const filteredUserData = Object.fromEntries(
      Object.entries(userData).filter(([, value]) => value !== undefined),
    )

    const payload = {
      data: [
        {
          event_name: eventName,
          event_id: eventID,
          event_time: Math.floor(Date.now() / 1000),
          action_source: 'website',
          event_source_url: referer,
          user_data: filteredUserData,
          custom_data: clientData || {},
        },
      ],
    }

    const url = `https://graph.facebook.com/v14.0/${pixelId}/events?access_token=${capiToken}`

    const fbResponse = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const result = await fbResponse.json()

    return NextResponse.json(result)
  } catch (error) {
    console.error('FB CAPI error', error)
    return NextResponse.json({ error: 'Facebook API failed' }, { status: 500 })
  }
}
