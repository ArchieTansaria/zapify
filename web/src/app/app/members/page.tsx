"use client"

import { useEffect, useState } from "react"
import { Users, UserPlus, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { useOrganization } from "@/components/providers/organization-provider"
import { fetchMembers, Member } from "@/lib/graphql/members"
import { Card } from "@/components/ui/card"

export default function MembersPage() {
  const { currentOrganizationId, isLoading: orgLoading } = useOrganization()
  const [members, setMembers] = useState<Member[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (orgLoading) return
    
    if (!currentOrganizationId) {
      queueMicrotask(() => {
        setMembers([])
        setIsLoading(false)
      })
      return
    }

    let isMounted = true
    queueMicrotask(() => setIsLoading(true))
    
    fetchMembers(currentOrganizationId).then((m) => {
      if (isMounted) {
        setMembers(m)
        setIsLoading(false)
      }
    })

    return () => {
      isMounted = false
    }
  }, [currentOrganizationId, orgLoading])

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Members</h1>
          <p className="text-muted-foreground mt-2">
            Manage organization members and their roles.
          </p>
        </div>
        <Button className="w-full sm:w-auto gap-2">
          <UserPlus className="h-4 w-4" />
          Invite member
        </Button>
      </div>

      <div className="mt-8">
        {isLoading || orgLoading ? (
          <div className="space-y-4">
            <div className="h-16 w-full rounded-xl bg-muted animate-pulse" />
            <div className="h-16 w-full rounded-xl bg-muted animate-pulse" />
          </div>
        ) : members.length > 1 ? (
          <Card className="divide-y divide-border">
            {members.map((member) => (
              <div key={member.id} className="flex items-center justify-between p-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground border">
                    <User className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-medium leading-none">{member.user?.displayName || "User"}</p>
                    <p className="text-sm text-muted-foreground mt-1">{member.user?.email || "No email"}</p>
                  </div>
                </div>
                <div className="text-sm text-muted-foreground capitalize bg-secondary px-2 py-1 rounded-md">
                  {member.role}
                </div>
              </div>
            ))}
          </Card>
        ) : (
          <EmptyState
            icon={Users}
            title="No additional members"
            description="You are the only member in this organization. Invite your team to collaborate on workflows."
          />
        )}
      </div>
    </div>
  )
}

