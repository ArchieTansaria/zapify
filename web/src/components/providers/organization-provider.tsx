"use client"

import React, { createContext, useContext, useEffect, useState } from "react"
import { useAuth } from "./auth-provider"
import { fetchUserOrganizations, Organization, OrgMembership } from "@/lib/graphql/organizations"

interface OrganizationContextType {
  organizations: Organization[]
  currentOrganization: Organization | null
  currentOrganizationId: string | null
  currentUserRole: string | null
  isLoading: boolean
  switchOrganization: (id: string) => void
}

const OrganizationContext = createContext<OrganizationContextType>({
  organizations: [],
  currentOrganization: null,
  currentOrganizationId: null,
  currentUserRole: null,
  isLoading: true,
  switchOrganization: () => {},
})

const ORG_STORAGE_KEY = "zapify:currentOrgId"

export function OrganizationProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoading: authLoading } = useAuth()
  
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [memberships, setMemberships] = useState<OrgMembership[]>([])
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (authLoading) return

    if (!user) {
      queueMicrotask(() => {
        setOrganizations([])
        setMemberships([])
        setCurrentOrgId(null)
        setIsLoading(false)
      })
      return
    }

    let isMounted = true
    queueMicrotask(() => setIsLoading(true))

    fetchUserOrganizations(user.id).then(({ organizations: orgs, memberships: mems }) => {
      if (!isMounted) return

      setOrganizations(orgs)
      setMemberships(mems)

      if (orgs.length > 0) {
        // Try to restore from localStorage
        const savedId = localStorage.getItem(ORG_STORAGE_KEY)
        const isValidSaved = savedId && orgs.some((o) => o.id === savedId)

        if (isValidSaved) {
          setCurrentOrgId(savedId)
        } else {
          setCurrentOrgId(orgs[0].id)
          localStorage.setItem(ORG_STORAGE_KEY, orgs[0].id)
        }
      } else {
        setCurrentOrgId(null)
        localStorage.removeItem(ORG_STORAGE_KEY)
      }
      setIsLoading(false)
    }).catch((err) => {
      console.error("Failed to fetch organizations:", err)
      if (isMounted) setIsLoading(false)
    })

    return () => {
      isMounted = false
    }
  }, [user, authLoading])

  const switchOrganization = (id: string) => {
    if (organizations.some((o) => o.id === id)) {
      setCurrentOrgId(id)
      localStorage.setItem(ORG_STORAGE_KEY, id)
    }
  }

  const currentOrganization = organizations.find((o) => o.id === currentOrgId) || null
  const currentUserRole = memberships.find((m) => m.org_id === currentOrgId)?.role || null

  return (
    <OrganizationContext.Provider
      value={{
        organizations,
        currentOrganization,
        currentOrganizationId: currentOrgId,
        currentUserRole,
        isLoading: isLoading || authLoading,
        switchOrganization,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  )
}

export function useOrganization() {
  return useContext(OrganizationContext)
}
