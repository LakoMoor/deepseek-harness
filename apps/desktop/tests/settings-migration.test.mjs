import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { migrateLegacyAgentPreset } from '../src/settings-migration.mjs'

test('migrates the preview-era agent preset without changing neighboring settings', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-desktop-settings-'))
  const filename = join(directory, 'settings.yaml')
  await writeFile(filename, [
    '# retained comment',
    'agent-presets:',
    '  default: code',
    'ui-theme:',
    '  preference: dark',
    '',
  ].join('\n'))

  assert.equal(await migrateLegacyAgentPreset(directory), true)
  assert.equal(await readFile(filename, 'utf8'), [
    '# retained comment',
    'agent-presets:',
    '  default: standard',
    'ui-theme:',
    '  preference: dark',
    '',
  ].join('\n'))
  assert.equal(await migrateLegacyAgentPreset(directory), false)
})

test('leaves absent settings and non-legacy defaults unchanged', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-desktop-settings-'))
  assert.equal(await migrateLegacyAgentPreset(directory), false)
  const filename = join(directory, 'settings.yaml')
  const source = 'agent-presets:\n  default: minimal\n'
  await writeFile(filename, source)

  assert.equal(await migrateLegacyAgentPreset(directory), false)
  assert.equal(await readFile(filename, 'utf8'), source)
})
