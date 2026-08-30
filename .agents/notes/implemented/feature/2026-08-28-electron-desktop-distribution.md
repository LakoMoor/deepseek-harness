# Agent Note: Electron desktop distribution

Status: implemented

English | [中文](2026-08-28-electron-desktop-distribution.zh.md)

## Problem

The shipped Web profile provides the complete graphical Harness but requires users to launch a CLI process and keep a browser tab. A desktop distribution needs one application lifecycle without creating a second backend composition, and its platform-specific native dependencies cannot be trusted when packaged for every operating system from one host.

## Decision

`apps/desktop` owns an Electron shell whose main process starts the built `dsh web` entry in a child process through Electron's packaged Node runtime. The backend alone receives Node's `--expose-internals` flag required by the profile's live configuration reload; the sandboxed renderer receives no Node flags or APIs. The profile binds to loopback on an operating-system-assigned port, suppresses its browser handoff, and remains the authority for readiness and authenticated URL construction. Electron waits for the printed readiness URL before showing one `BrowserWindow` and terminates the backend with the application lifecycle. Backend failures retain bounded stderr and display it with the exit code.

The desktop production dependencies include the repository's dependency-only Python deploy root, which already enumerates the CLI plugin and peer closure, plus the remaining Web-profile peers. Electron packaging therefore follows one maintained runtime inventory instead of copying the CLI's development dependencies into a second list.

The application resource directory remains unpacked. Profile startup projects ordinary filesystem links from `$DSH_HOME/profiles/node_modules` into the installation dependency closure; an ASAR virtual path cannot be the target of those links for Node's ESM resolver. Platform installers still compress and sign the resource directory as part of the application artifact.

Fallback healing treats an owned link whose old target traverses an invalid virtual archive as stale and replaces it with the current installation target. An upgrade from an earlier ASAR build therefore preserves the user's profile and patch files instead of requiring manual cleanup under `$DSH_HOME`.

The desktop workspace stays private because DMG, ZIP, NSIS, and AppImage files are its release artifacts; npm is only the build graph and its runtime closure includes a private deployment-root package. The workspace constraint gate records this application-specific exception while retaining publication requirements for the CLI and Web applications.

The desktop patch passes the operating-system home directory to its host bootstrap plugin. The plugin registers that existing directory through the durable `WorkspaceRegistry` before the client baseline opens. The existing Workspace navigation policy then creates or reuses a blank Session and selects it, so a clean desktop profile starts with an editable composer instead of waiting for a manual Workspace choice. Repeated launches reuse the canonical Workspace registration.

Earlier preview builds stored `agent-presets.default: code`, while the shipped roster names its successor `standard`. The desktop main process performs that exact comment-preserving YAML migration before backend startup. Other preset ids remain untouched. Without the migration, automatic Workspace selection fails while creating its blank Session and leaves the composer in the misleading Workspace-required state.

The renderer stays sandboxed with context isolation and without Node.js integration. A narrow preload bridge exposes the desktop platform plus local-model state, state-change subscription, download, file-selection, disable, and onboarding-dismiss operations; the main process rejects requests from any sender other than the application window. The renderer denies permission requests, restricts navigation and child windows to the backend origin, and delegates external HTTP links to the operating-system browser. A single-instance lock routes a second launch to the existing window.

The main process owns local GGUF acquisition outside the sandboxed renderer. A desktop-only client plugin offers the model on first launch and fills the Models settings footer with download, existing-file selection, and disable controls; the application and tray menus provide native equivalents. Starting the maintained download completes onboarding immediately and creates one main-process task that survives renderer navigation and a window hidden to the tray. The main process publishes throttled byte counts to renderer subscribers while Electron retains native taskbar or dock progress; the custom title bar and Models settings render determinate or indeterminate progress. `node-llama-cpp` downloads from Hugging Face, stores completed models under Electron's user-data directory, and can retain an absolute path to an existing GGUF. Selecting or disabling a model restarts only the Web-profile child; the enabled patch mounts `dsh-llm-local` and selects `local/local-gguf` for new sessions. The adapter retains model weights across requests, allocates a separate context for each request, translates Harness tool history through the model's chat template, and reports llama.cpp token counts.

The icon source is the repository's official DeepSeek whale vector rendered in white on the product blue. Electron Builder derives each platform icon format from the 1024-pixel PNG, so the installer, application bundle, running process, and tray entry share the Web product mark. The `BrowserWindow` hides the operating-system title frame; a desktop-only `shell.overlay` occupant supplies draggable application chrome, centers the product mark independently of the native controls, reserves content space, and leaves the native traffic lights or window buttons available. Window close hides the application while the tray retains show, model-management, and quit actions.

`electron-builder` produces DMG and ZIP, NSIS, and AppImage targets. The distribution workflow installs and builds the monorepo independently on native x64 and ARM64 runners for macOS, Windows, and Linux, so native modules are installed for the exact operating-system and architecture pair. Manual runs retain installers as workflow artifacts; a `desktop-v*` tag collects the same matrix outputs into a GitHub Release. macOS development artifacts receive an explicit ad-hoc signature with Electron runtime entitlements; trusted public releases replace that identity with a Developer ID identity and add notarization in the release environment.

## Verification

The desktop package participates in the pnpm workspace and frozen lockfile. Repository scripts build the normal Harness artifacts before development launch or packaging, and the CI matrix rejects an operating-system family when its expected release files are absent.

## Alternatives considered

**Load the SPA through `file://` and add a new IPC transport.** Rejected for this distribution because the shipped application already has an authenticated HTTP and WebSocket transport with startup injection, trust, and lifecycle behavior. A parallel IPC transport would require a separate host composition and client connection implementation.

**Cross-build every artifact on one machine.** Rejected because the Harness includes native process, terminal, persistence, and sandbox dependencies. Native runner families keep installation and packaging aligned with the operating system that executes the artifact.

**Open the system browser from a packaged launcher.** Rejected because it does not provide a desktop window lifecycle and leaves navigation, permissions, and instance ownership to an unrelated browser process.

## Consequences

The desktop application reuses the supported Web profile and its settings, credentials, and frontend without changing the agent runtime. It gains one-window startup, custom draggable chrome, tray residency, non-blocking first-run local setup, settings-based model management, free-port selection, native installers, a device-local GGUF route, and a branded platform icon while retaining a loopback HTTP server inside the local application. The maintained default model requires an approximately 2.5 GB download and its context consumes device RAM or VRAM; no model weights are bundled in installers. Local macOS applications pass structural signature verification but remain untrusted and unnotarized. Release automation must run all six platform-architecture jobs, replace the ad-hoc macOS identity, and supply platform signing credentials for trusted public releases.
