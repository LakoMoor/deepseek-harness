import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('uses a filesystem-safe executable and matching Linux desktop identity', async () => {
  const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
  const build = packageJson.build

  assert.match(build.executableName, /^[A-Za-z0-9._ -]+$/)
  assert.equal(build.executableName, 'deepseek-harness')
  assert.equal(packageJson.desktopName, build.executableName)
  assert.equal(build.linux.syncDesktopName, true)
})
