import { Settings } from "lucide-react"
import { EmptyState } from "@/components/ui/empty-state"

export const metadata = {
  title: "Settings | Zapify",
}

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-2">
          Manage your organization preferences and billing.
        </p>
      </div>

      <div className="mt-8">
        <EmptyState
          icon={Settings}
          title="Organization Settings"
          description="Settings configuration will be available in a future update."
        />
      </div>
    </div>
  )
}
