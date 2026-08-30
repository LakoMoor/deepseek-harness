/** Desktop-owned migrations for settings written by earlier preview builds. */

import { readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { parseDocument } from 'yaml'

const LEGACY_AGENT_PRESET = 'code'
const CURRENT_AGENT_PRESET = 'standard'

/** Whether a filesystem error reports an absent settings document. */
function isENOENT(error) {
  return error?.code === 'ENOENT'
}

/**
 * Replace the preview-era `code` agent preset with its shipped successor.
 * Other values, YAML formatting, and comments remain unchanged.
 * @param {string} dshHome - Harness home containing `settings.yaml`.
 * @returns {Promise<boolean>} whether the document was migrated.
 */
export async function migrateLegacyAgentPreset(dshHome) {
  const filename = join(dshHome, 'settings.yaml')
  let source
  try {
    source = await readFile(filename, 'utf8')
  } catch (error) {
    if (isENOENT(error)) return false
    throw error
  }
  const document = parseDocument(source)
  if (document.errors.length > 0) throw document.errors[0]
  if (document.getIn(['agent-presets', 'default']) !== LEGACY_AGENT_PRESET) return false
  document.setIn(['agent-presets', 'default'], CURRENT_AGENT_PRESET)
  const temporary = `${filename}.${process.pid}.tmp`
  await writeFile(temporary, document.toString(), { mode: 0o600 })
  await rename(temporary, filename)
  return true
}
