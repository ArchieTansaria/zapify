import { nhost } from "./src/lib/nhost.ts"
nhost.graphql.request({ query: "query { organizations { id } }" })
  .then(console.log)
  .catch(console.error)
