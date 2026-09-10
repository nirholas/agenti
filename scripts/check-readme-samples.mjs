#!/usr/bin/env node
/**
 * Typechecks the TypeScript samples in the root README and every package README
 * against the real package types.
 *
 * README samples drift silently: nothing compiles them, so a renamed export or
 * a changed constructor signature leaves the docs confidently wrong. This
 * extracts every ```ts block, compiles it against the built .d.ts files, and
 * reports the errors that mean the documented API does not exist.
 *
 * Samples are fragments, not programs: they reference wallets, task ids and
 * handlers the reader is expected to supply. Errors about unresolved names are
 * therefore expected and ignored. What is not ignored is the sample being wrong
 * about the package itself: importing something the package does not export,
 * calling a function with the wrong number or type of arguments, or reaching
 * for a property that is not there.
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
// Samples compile inside a workspace member so pnpm links every @agenti
// package for them; a temp dir under node_modules would resolve nothing.
const OUT = join(ROOT, 'scripts', 'checks', 'generated')

/** Errors that mean the documented API is wrong, rather than the sample being a fragment. */
const API_ERRORS = new Set([
  'TS2305', // module has no exported member
  'TS2724', // no exported member, did you mean
  'TS2307', // cannot find module
  'TS2339', // property does not exist on type
  'TS2554', // wrong number of arguments
  'TS2555', // too few arguments
  'TS2345', // argument type mismatch
  'TS2353', // object literal may only specify known properties
  'TS2559', // type has no properties in common
  'TS2739', // missing required properties
  'TS2741', // missing required property
])

/**
 * Wraps a sample so it compiles as a module.
 *
 * Imports have to stay at the top level, so they are hoisted out; the rest goes
 * inside an async function, which lets a sample use await and keeps one
 * sample's declarations from colliding with the next one's.
 */
function wrapSample(sample) {
  const lines = sample.split('\n')
  const imports = []
  const body = []
  let inImport = false

  for (const line of lines) {
    if (inImport) {
      imports.push(line)
      if (line.includes('from ') || line.trim().endsWith("'")) inImport = false
      continue
    }
    if (/^\s*import\s/.test(line)) {
      imports.push(line)
      // A multi-line import stays open until its `from` clause arrives.
      if (!line.includes('from ') && !line.trim().endsWith("'")) inImport = true
      continue
    }
    body.push(line)
  }

  return `${imports.join('\n')}\nexport async function sample() {\n${body.join('\n')}\n}\n`
}

function extractSamples(markdown) {
  const samples = []
  const fence = /```ts\n([\s\S]*?)```/g
  let match
  while ((match = fence.exec(markdown)) !== null) samples.push(match[1])
  return samples
}

/** Every README with samples worth compiling: the root one, and each package. */
const readmes = [
  ...(existsSync(join(ROOT, 'README.md')) ? [{ id: 'root', path: join(ROOT, 'README.md') }] : []),
  ...readdirSync(join(ROOT, 'packages'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => existsSync(join(ROOT, 'packages', name, 'README.md')))
    .map((name) => ({ id: name, path: join(ROOT, 'packages', name, 'README.md') })),
]

rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })

let fileCount = 0
const origins = new Map()

for (const readme of readmes) {
  const samples = extractSamples(readFileSync(readme.path, 'utf8'))
  samples.forEach((sample, index) => {
    const name = `${readme.id}-${index}.ts`
    writeFileSync(join(OUT, name), wrapSample(sample))
    origins.set(name, readme.path.replace(`${ROOT}/`, ''))
    fileCount += 1
  })
}

writeFileSync(
  join(OUT, 'tsconfig.json'),
  JSON.stringify(
    {
      extends: '../../../tsconfig.base.json',
      compilerOptions: {
        noEmit: true,
        noUnusedLocals: false,
        noUnusedParameters: false,
        exactOptionalPropertyTypes: false,
        types: ['node'],
      },
      include: ['*.ts'],
    },
    null,
    2,
  ),
)

let output = ''
try {
  execFileSync('npx', ['tsc', '-p', join(OUT, 'tsconfig.json'), '--noEmit'], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
} catch (err) {
  output = `${err.stdout ?? ''}${err.stderr ?? ''}`
}

const failures = output
  .split('\n')
  .filter((line) => {
    const code = line.match(/error (TS\d+):/)
    return code && API_ERRORS.has(code[1])
  })
  .map((line) => {
    const file = line.match(/^([\w.-]+\.ts)\((\d+),/)
    if (!file) return line
    const origin = origins.get(file[1]) ?? file[1]
    return `${origin}: ${line.slice(line.indexOf('error'))}`
  })

console.log(`Checked ${fileCount} TypeScript samples across ${readmes.length} READMEs.`)

if (failures.length > 0) {
  console.error(`\n${failures.length} sample(s) do not match the package API:\n`)
  for (const failure of failures) console.error(`  ${failure}`)
  console.error('\nFix the README, or the code it documents.')
  process.exit(1)
}

console.log('Every sample matches the API it documents.')
