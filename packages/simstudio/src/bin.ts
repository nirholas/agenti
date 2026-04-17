import { serve } from '@hono/node-server'
import { createSimStudioBridge } from './server.js'

const port = Number(process.env.PORT ?? 3200)
const app = createSimStudioBridge()

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`agenti SimStudio bridge running on http://localhost:${info.port}`)
  console.log('Configure SimStudio tools with serverUrl: http://localhost:' + info.port)
})
