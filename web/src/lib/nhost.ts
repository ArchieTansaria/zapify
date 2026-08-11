import { createClient } from "@nhost/nhost-js"
import { CookieStorage } from "@nhost/nhost-js/session"

const isBrowser = typeof window !== "undefined"

export const nhost = createClient({
  subdomain: process.env.NEXT_PUBLIC_NHOST_SUBDOMAIN || "local",
  region: process.env.NEXT_PUBLIC_NHOST_REGION || "local",
  storage: isBrowser 
    ? new CookieStorage({
        secure: process.env.NODE_ENV === "production",
      })
    : undefined
})

