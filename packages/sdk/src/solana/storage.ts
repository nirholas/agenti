import { readFileSync, writeFileSync, mkdirSync, renameSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

export interface EventStore {
  has(key: string): boolean | Promise<boolean>
  set(key: string, value: unknown): void | Promise<void>
  get(key: string): unknown | Promise<unknown>
}

export class MemoryStore implements EventStore {
  private store = new Map<string, unknown>()

  has(key: string): boolean {
    return this.store.has(key)
  }

  set(key: string, value: unknown): void {
    this.store.set(key, value)
  }

  get(key: string): unknown {
    return this.store.get(key)
  }
}

export class FileStore implements EventStore {
  private readonly filePath: string
  private cache: Record<string, unknown>

  constructor(filePath: string) {
    this.filePath = resolve(filePath)
    mkdirSync(dirname(this.filePath), { recursive: true })
    this.cache = this.load()
  }

  private load(): Record<string, unknown> {
    try {
      if (!existsSync(this.filePath)) return {}
      return JSON.parse(readFileSync(this.filePath, 'utf-8')) as Record<string, unknown>
    } catch {
      return {}
    }
  }

  private save(): void {
    const tmp = this.filePath + '.tmp'
    writeFileSync(tmp, JSON.stringify(this.cache, null, 2), 'utf-8')
    renameSync(tmp, this.filePath)
  }

  has(key: string): boolean {
    return key in this.cache
  }

  set(key: string, value: unknown): void {
    this.cache[key] = value
    this.save()
  }

  get(key: string): unknown {
    return this.cache[key]
  }
}
