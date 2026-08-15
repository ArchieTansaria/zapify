import { createClient } from "@nhost/nhost-js"
const nhost = createClient({ subdomain: "local" })
console.log(Object.keys(nhost.auth).filter(k => typeof nhost.auth[k] === 'function'))
