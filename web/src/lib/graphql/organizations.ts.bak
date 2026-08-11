import { nhost } from "@/lib/nhost"

export interface Organization {
  id: string
  name: string
  quota_limit: number
  quota_used: number
}

export interface OrgMembership {
  role: string
  org_id: string
}

const GET_USER_ORGANIZATIONS = `
  query GetUserOrganizations($userId: uuid!) {
    organizations(order_by: { name: asc }) {
      id
      name
      quota_limit
      quota_used
    }
    org_members(where: { user_id: { _eq: $userId } }) {
      org_id
      role
    }
  }
`

export async function fetchUserOrganizations(userId: string) {
  const res = await nhost.graphql.request({ query: GET_USER_ORGANIZATIONS, variables: { userId } })
  const data = res.body.data as Record<string, unknown>
  const errors = res.body.errors
  
  if (errors) {
    console.error("Error fetching organizations:", errors)
    return { organizations: [], memberships: [] }
  }

  return {
    organizations: (data?.organizations as Organization[]) || [],
    memberships: (data?.org_members as OrgMembership[]) || [],
  }
}
