import { Users, UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"

export const metadata = {
  title: "Members | Zapify",
}

export default function MembersPage() {
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
        {/* We use an empty state here for M4.1 as per instructions to not fake data */}
        <EmptyState
          icon={Users}
          title="No additional members"
          description="You are the only member in this organization. Invite your team to collaborate on workflows."
        />
      </div>
    </div>
  )
}
