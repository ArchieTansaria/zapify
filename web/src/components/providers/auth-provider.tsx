"use client"

import React, { createContext, useContext, useEffect, useState } from "react"
import { nhost } from "@/lib/nhost"

export interface User {
  id: string;
  email?: string;
  displayName?: string;
}

interface AuthContextType {
  user: User | null
  isLoading: boolean
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    setUser((nhost.getUserSession()?.user as User) || null)
    setIsLoading(false)
    // Listen for auth changes
    const unsubscribe = nhost.sessionStorage.onChange((session) => {
      queueMicrotask(() => {
        setUser((session?.user as User) || null)
        setIsLoading(false)
      })
    })

    // If we missed an initial update
    queueMicrotask(() => {
      setUser((nhost.getUserSession()?.user as User) || null)
      setIsLoading(false)
    })

    return () => {
      unsubscribe()
    }
  }, [])

  return (
    <AuthContext.Provider value={{ user, isLoading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
