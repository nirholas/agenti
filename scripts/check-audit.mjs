#!/usr/bin/env node
/**
 * Fails the build on a critical or high advisory in the production tree.
 *
 * Two unauthenticated RCEs sat in this repo's dashboard for months because
 * nothing ran an audit. A dependency tree only stays clean if something checks,
 * so this runs with the rest of the gate.
 *
 * Moderate and low advisories are reported but do not fail: at this dependency
 * depth they are constant background noise, and a check that always fails
 * teaches people to ignore it.
 */
import { execFileSync } from 'node:child_process'

/**
 * Advisories accepted as known, each with the reason it cannot be fixed.
 *
 * An entry here is a decision, not a mute button. Anything added needs a reason
 * that would survive being read out loud, and should be removed the moment a
 * fix exists.
 */
const ACCEPTED = {
  'bigint-buffer':
    'Reached through @solana/spl-token. The package is abandoned and its advisory ' +
    'lists no patched version, so no override can fix it. It goes when the Solana ' +
    'token libraries drop it.',
}

let raw = ''
try {
  raw = execFileSync('pnpm', ['audit', '--prod', '--json'], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'ignore'],
  })
} catch (err) {
  // pnpm exits non-zero whenever it finds anything, so the report still arrives
  // on stdout and only a missing report is a real failure.
  raw = err.stdout ?? ''
  if (!raw) {
    console.error('Could not run pnpm audit. Is the workspace installed?')
    process.exit(1)
  }
}

let report
try {
  report = JSON.parse(raw)
} catch {
  console.error('pnpm audit did not return JSON. Skipping is not an option here; fix the run.')
  process.exit(1)
}

const advisories = Object.values(report.advisories ?? {})
const counts = advisories.reduce((acc, a) => {
  acc[a.severity] = (acc[a.severity] ?? 0) + 1
  return acc
}, {})

const blocking = new Map()
const accepted = new Map()

for (const advisory of advisories) {
  if (advisory.severity !== 'critical' && advisory.severity !== 'high') continue
  const target = ACCEPTED[advisory.module_name] ? accepted : blocking
  if (!target.has(advisory.module_name)) {
    target.set(advisory.module_name, {
      severity: advisory.severity,
      patched: advisory.patched_versions,
      title: advisory.title,
    })
  }
}

const summary = ['critical', 'high', 'moderate', 'low']
  .map((s) => `${counts[s] ?? 0} ${s}`)
  .join(', ')
console.log(`Production advisories: ${advisories.length} (${summary})`)

if (accepted.size > 0) {
  console.log('\nAccepted, with a recorded reason:')
  for (const [name, info] of accepted) {
    console.log(`  ${info.severity.padEnd(8)} ${name}`)
    console.log(`           ${ACCEPTED[name]}`)
  }
}

if (blocking.size > 0) {
  console.error(`\n${blocking.size} package(s) at high or critical with no accepted reason:\n`)
  for (const [name, info] of blocking) {
    console.error(`  ${info.severity.padEnd(8)} ${name}`)
    console.error(`           ${info.title}`)
    console.error(`           patched: ${info.patched}`)
  }
  console.error(
    '\nFix by bumping the direct dependency, or by adding a pnpm override in the\n' +
      'root package.json when the package is transitive. Accepting one instead\n' +
      'means adding it to ACCEPTED in this script with the reason.',
  )
  process.exit(1)
}

console.log('\nNothing critical or high without an accepted reason.')
