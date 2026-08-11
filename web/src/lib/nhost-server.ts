import { cookies } from "next/headers"
import { createServerClient } from "@nhost/nhost-js"
import { DEFAULT_SESSION_KEY, StoredSession } from "@nhost/nhost-js/session"

export async function getNhost() {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get(DEFAULT_SESSION_KEY)
  
  let initialSession: StoredSession | null = null
  if (sessionCookie?.value) {
    try {
      initialSession = JSON.parse(decodeURIComponent(sessionCookie.value))
    } catch {
      // Invalid session cookie
    }
  }

  return createServerClient({
    subdomain: process.env.NEXT_PUBLIC_NHOST_SUBDOMAIN || "local",
    region: process.env.NEXT_PUBLIC_NHOST_REGION || "local",
    storage: {
      get: () => initialSession,
      set: (value) => {
        try {
          cookieStore.set({
            name: DEFAULT_SESSION_KEY,
            value: encodeURIComponent(JSON.stringify(value)),
            path: "/",
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 30 * 24 * 60 * 60, // 30 days
          })
        } catch (e) {
          // Setting cookies in server components throws, this is expected if not in an action/middleware
        }
      },
      remove: () => {
        try {
          cookieStore.delete(DEFAULT_SESSION_KEY)
        } catch (e) {
          // Ignore throws in read-only contexts
        }
      }
    }
  })
}
