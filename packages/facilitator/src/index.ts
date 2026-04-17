import express, { type Application } from 'express'
import type { Request, Response } from 'express'
import { verifyPayment } from './verify.js'
import { settlePayment } from './settle.js'
import type { FacilitatorConfig, PaymentPayload, PaymentRequired } from './types.js'

export type { FacilitatorConfig, PaymentPayload, PaymentRequired } from './types.js'
export type { VerifyResult, SettleResult } from './types.js'
export { verifyPayment, isNonceUsed, markNonceUsed } from './verify.js'
export { settlePayment } from './settle.js'

interface VerifyBody {
  payment: PaymentPayload
  requirements: PaymentRequired
}

/**
 * Creates an Express app that exposes the x402 facilitator HTTP API.
 *
 * POST /verify  — verify a payment signature without settling
 * POST /settle  — verify and settle on-chain (requires settlerPrivateKey)
 * GET  /health  — liveness probe
 */
export function createFacilitator(config: FacilitatorConfig = {}): Application {
  const app = express()
  app.use(express.json())

  app.get('/health', (_req: Request, res: Response) => {
    res.json({ ok: true })
  })

  app.post('/verify', (req: Request, res: Response) => {
    const { payment, requirements } = req.body as VerifyBody
    if (!payment || !requirements) {
      res.status(400).json({ valid: false, error: 'Missing payment or requirements' })
      return
    }
    verifyPayment(payment, requirements).then((result) => {
      res.status(result.valid ? 200 : 400).json(result)
    }).catch((err: unknown) => {
      res.status(500).json({ valid: false, error: String(err) })
    })
  })

  app.post('/settle', (req: Request, res: Response) => {
    const { payment, requirements } = req.body as VerifyBody
    if (!payment || !requirements) {
      res.status(400).json({ settled: false, error: 'Missing payment or requirements' })
      return
    }
    settlePayment(payment, requirements, config).then((result) => {
      res.status(result.settled ? 200 : 400).json(result)
    }).catch((err: unknown) => {
      res.status(500).json({ settled: false, error: String(err) })
    })
  })

  return app
}
