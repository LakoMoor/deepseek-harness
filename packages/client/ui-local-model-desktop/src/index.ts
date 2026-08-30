/** Host bootstrap for the desktop shell and local-model browser implementation. */

import type { Context } from '@deepseek-ai/cordis'
import Schema from '@deepseek-ai/schemastery'
import type {} from '@deepseek-ai/dsh-workspace'

/** Desktop-owned startup configuration. */
export interface Config {
  /** Existing directory registered as the initial desktop Workspace. */
  readonly workspacePath: string
}

/** Validate the initial desktop Workspace path. */
export const Config: Schema<Config> = Schema.object({
  workspacePath: Schema.string().required(),
})

/** Host service required to make the desktop shell usable on first launch. */
export const inject = ['workspaceRegistry']

/**
 * Register the desktop start directory before the client receives its Workspace baseline.
 * @param ctx - Host context carrying the durable Workspace registry.
 * @param config - Desktop startup configuration.
 */
export async function apply(ctx: Context, config: Config): Promise<void> {
  await ctx.workspaceRegistry.create(config.workspacePath)
}
