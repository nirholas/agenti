export interface AbiParameter {
  name: string
  type: string
  components?: AbiParameter[]
  internalType?: string
}

export interface AbiItem {
  type: 'function' | 'constructor' | 'event' | 'error' | 'fallback' | 'receive'
  name?: string
  inputs?: AbiParameter[]
  outputs?: AbiParameter[]
  stateMutability?: 'pure' | 'view' | 'nonpayable' | 'payable'
  anonymous?: boolean
}

export type FunctionKind = 'read' | 'write' | 'payable'

export interface ParsedFunction {
  name: string
  kind: FunctionKind
  inputs: AbiParameter[]
  outputs: AbiParameter[]
  rawItem: AbiItem
}

export function parseFunctions(abi: AbiItem[]): ParsedFunction[] {
  return abi
    .filter((item): item is AbiItem & { name: string } => item.type === 'function' && !!item.name)
    .map((item) => ({
      name: item.name,
      kind: getFunctionKind(item),
      inputs: item.inputs ?? [],
      outputs: item.outputs ?? [],
      rawItem: item,
    }))
}

function getFunctionKind(item: AbiItem): FunctionKind {
  const mut = item.stateMutability
  if (mut === 'view' || mut === 'pure') return 'read'
  if (mut === 'payable') return 'payable'
  return 'write'
}

/** Convert a Solidity type to a Zod schema expression string */
export function solidityTypeToZod(type: string, components?: AbiParameter[]): string {
  // Strip trailing [] for arrays
  if (type.endsWith('[]')) {
    const inner = solidityTypeToZod(type.slice(0, -2), components)
    return `z.array(${inner})`
  }
  // Fixed-size arrays like uint256[3]
  const fixedArr = type.match(/^(.+)\[(\d+)\]$/)
  if (fixedArr) {
    const inner = solidityTypeToZod(fixedArr[1]!, components)
    return `z.array(${inner})`
  }

  if (type === 'tuple' && components) {
    const fields = components
      .map((c) => `${JSON.stringify(c.name || '_')}: ${solidityTypeToZod(c.type, c.components)}`)
      .join(', ')
    return `z.object({ ${fields} })`
  }

  if (type === 'address') return `z.string().regex(/^0x[0-9a-fA-F]{40}$/)`
  if (type === 'bool') return `z.boolean()`
  if (type === 'string') return `z.string()`
  if (type.startsWith('bytes')) return `z.string()`
  if (type.startsWith('uint') || type.startsWith('int')) return `z.string()`

  return `z.string()`
}

export function toSnakeCase(name: string): string {
  const s1 = name.replace(/(.)([A-Z][a-z]+)/g, '$1_$2')
  return s1.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase()
}

export function toPascalCase(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1)
}
