import { createClient } from "@nhost/nhost-js"
const nhost = createClient({ subdomain: "local" })
console.log(nhost.auth.session)
console.log(nhost.auth.getSession)
