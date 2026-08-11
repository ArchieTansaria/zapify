import { nhost } from "@/lib/nhost"

export interface Member {
  id: string
  user_id: string
  role: string
  created_at: string
  user: {
    displayName: string
    email: string
  }
}

const GET_MEMBERS = `
  query GetMembers($orgId: uuid!) {
    org_members(where: { org_id: { _eq: $orgId } }, order_by: { created_at: asc }) {
      id
      user_id
      role
      created_at
      user {
        displayName
        email
      }
    }
  }
`

export async function fetchMembers(orgId: string) {
  const res = await nhost.graphql.request({ query: GET_MEMBERS, variables: { orgId } })
  const data = res.body.data as Record<string, unknown>
  const errors = res.body.errors
  
  if (errors) {
    console.error("Error fetching members:", errors)
    return []
  }

  return (data?.org_members as Member[]) || []
}
