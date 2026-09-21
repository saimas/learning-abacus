import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const DOMAIN_DIR = join(__dirname)
const FORBIDDEN = [
  'react',
  'react-native',
  '@react-native-async-storage/async-storage',
  'expo',
  '../storage',
  '../ui',
  '@/ui',
  '@/storage',
  '@/i18n',
]

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry: string) => {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) return sourceFiles(full)
    if (!full.endsWith('.ts') || full.endsWith('.test.ts')) return []
    return [full]
  })
}

describe('domain purity', () => {
  const files = sourceFiles(DOMAIN_DIR)

  it('finds domain source files to check', () => {
    expect(files.length).toBeGreaterThan(0)
  })

  it.each(files)('%s imports no platform modules', (file) => {
    const source = readFileSync(file, 'utf8')
    const imports = [...source.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1] ?? '')
    const violations = imports.filter((spec) =>
      FORBIDDEN.some((banned) => spec === banned || spec.startsWith(`${banned}/`)),
    )
    expect(violations).toEqual([])
  })
})
