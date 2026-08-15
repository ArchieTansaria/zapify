import { createClient } from "@nhost/nhost-js"
const nhost = createClient({ subdomain: "local" })
console.log(nhost.graphql.getUrl ? nhost.graphql.getUrl() : nhost.graphql.url)
