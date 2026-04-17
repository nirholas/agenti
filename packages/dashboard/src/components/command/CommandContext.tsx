'use client'

import { createContext, useContext, useReducer, useEffect, type ReactNode } from 'react'
import { connectEventSource } from '../../lib/events'
import type { AgentiEvent } from '@agenti/sdk'

// ─── Types ────────────────────────────────────────────────────

export interface PayEvent   { id: string; url: string; amount: string; network: string; ts: number }
export interface TradeEvent { id: string; mint: string; side: 'buy' | 'sell'; sol: number; ts: number }
export interface InvoiceEvent { id: string; address: string; amount: number; token: string; ts: number }
export interface ErrorEvent { id: string; message: string; tool: string; ts: number }

export interface CommandState {
  payEvents: PayEvent[]
  tradeEvents: TradeEvent[]
  invoiceEvents: InvoiceEvent[]
  errorEvents: ErrorEvent[]
  walletAddress: string
  payCount: number
  tradeCount: number
  invoiceCount: number
  errorCount: number
  solBought: number
  solSold: number
  networksUsed: string[]
  urlHits: Record<string, number>
  isConnected: boolean
}

type Action =
  | { type: 'event'; event: AgentiEvent }
  | { type: 'connected'; value: boolean }

const MAX = 100
let seq = 0

function id(): string {
  return `${Date.now()}-${++seq}`
}

function reducer(state: CommandState, action: Action): CommandState {
  if (action.type === 'connected') return { ...state, isConnected: action.value }

  const { event } = action
  switch (event.type) {
    case 'pay': {
      const urlHits = { ...state.urlHits, [event.url]: (state.urlHits[event.url] ?? 0) + 1 }
      const networksUsed = state.networksUsed.includes(event.network)
        ? state.networksUsed
        : [...state.networksUsed, event.network]
      return {
        ...state,
        payEvents: [{ id: id(), url: event.url, amount: event.amount, network: event.network, ts: event.ts }, ...state.payEvents].slice(0, MAX),
        payCount: state.payCount + 1,
        urlHits,
        networksUsed,
      }
    }
    case 'trade':
      return {
        ...state,
        tradeEvents: [{ id: id(), mint: event.mint, side: event.side, sol: event.sol, ts: event.ts }, ...state.tradeEvents].slice(0, MAX),
        tradeCount: state.tradeCount + 1,
        solBought: event.side === 'buy'  ? state.solBought + event.sol : state.solBought,
        solSold:   event.side === 'sell' ? state.solSold   + event.sol : state.solSold,
      }
    case 'balance':
      return { ...state, walletAddress: event.address }
    case 'invoice':
      return {
        ...state,
        invoiceEvents: [{ id: id(), address: event.address, amount: event.amount, token: event.token, ts: event.ts }, ...state.invoiceEvents].slice(0, MAX),
        invoiceCount: state.invoiceCount + 1,
      }
    case 'error':
      return {
        ...state,
        errorEvents: [{ id: id(), message: event.message, tool: event.tool, ts: event.ts }, ...state.errorEvents].slice(0, MAX),
        errorCount: state.errorCount + 1,
      }
    default:
      return state
  }
}

function getInitialState(): CommandState {
  return {
    payEvents: [], tradeEvents: [], invoiceEvents: [], errorEvents: [],
    walletAddress: '',
    payCount: 0, tradeCount: 0, invoiceCount: 0, errorCount: 0,
    solBought: 0, solSold: 0,
    networksUsed: [], urlHits: {},
    isConnected: false,
  }
}

// ─── Context ──────────────────────────────────────────────────

const CommandContext = createContext<CommandState>(getInitialState())
export const useCommand = () => useContext(CommandContext)

export function CommandProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, getInitialState)

  useEffect(() => {
    dispatch({ type: 'connected', value: true })
    return connectEventSource(
      (event) => dispatch({ type: 'event', event }),
      () => dispatch({ type: 'connected', value: false }),
    )
  }, [])

  return (
    <CommandContext.Provider value={state}>
      {children}
    </CommandContext.Provider>
  )
}
