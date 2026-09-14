import { NextResponse } from 'next/server'

// Demo fixtures are an operator CLI task, never an authenticated-user capability.
export async function POST() {
  return NextResponse.json({ message: 'Web seeding is disabled. Use the local seed:demo command in an isolated demo database.' }, { status: 410 })
}
export const GET = POST
