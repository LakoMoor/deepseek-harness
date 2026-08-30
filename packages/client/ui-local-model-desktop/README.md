---
description: "Desktop Workspace bootstrap, title bar, and controls for local GGUF setup, progress, and model management."
kind: "package-reference"
---

# @deepseek-ai/dsh-client-ui-local-model-desktop

English | [中文](README.zh.md)

## Summary

This package is mounted by `apps/desktop`. Its host entry registers the configured start directory as a durable Workspace, so a clean desktop profile opens an editable blank Session without requiring a manual Workspace choice. When the Electron preload bridge is present, its client entry registers the custom title bar, a first-run onboarding step, and a Models settings footer card. A started download leaves onboarding immediately and continues in the Electron main process; the title bar and Settings receive progress events. The model surfaces can download the maintained GGUF, select an existing GGUF, and report native-operation failures; Settings can also disable the selected model. An ordinary browser receives no client registrations.

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="use-this-package"></a>
## Use this package

Mount the host entry with an existing `workspacePath` only in an Electron composition whose isolated preload defines `window.dshDesktop`. The desktop patch supplies the operating-system home directory; browser-only compositions omit this package.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

The host entry asks `WorkspaceRegistry` to canonicalize and durably register `workspacePath`; repeated starts reuse the same Workspace. The client receives a narrow bridge through its slot injection faces. Electron owns persistence, the long-lived download task, progress publication, native file selection, sender validation, and backend restart behavior; the React components own title-bar geometry and pending, progress, result, and failure presentation.

-----

<a id="further-exploration"></a>
## Further Exploration

- [Desktop application](../../../apps/desktop/README.md) — application lifecycle, model storage, and packaging.
- [Models settings](../ui-settings-models/README.md) — the settings footer slot occupied by this package.

-----

<a id="model-experience"></a>
## Model Experience

None, as this package manages local model installation and selection but contributes no content to model requests.

#### KV Cache effect

None; the local LLM adapter, not this UI package, owns inference contexts.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- **Electron only** — the controls remain absent without the preload bridge.
- **One managed download** — model selection and disable controls remain unavailable while the maintained model is downloading.

<a id="dev-note"></a>
### Dev Note

Run `pnpm exec vitest run packages/client/ui-local-model-desktop/tests/ui.client.spec.tsx --coverage --coverage.include='packages/client/ui-local-model-desktop/src/**/*.{ts,tsx}'` after changing this package.
