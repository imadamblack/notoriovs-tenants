import { NextResponse } from 'next/server'
import { DASHBOARD_COOKIE_NAME } from '@/utils/dashboardAuth'

export async function POST() {
  const res = NextResponse.json({ ok: true })
  res.cookies.set(DASHBOARD_COOKIE_NAME, '', { path: '/', maxAge: 0 })
  return res
}
