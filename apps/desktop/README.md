# DeepSeek Harness Desktop

English | [中文](README.zh.md)

This application runs the shipped `dsh web` profile in a child process backed by Electron's packaged Node runtime and opens its authenticated loopback URL in a sandboxed window. The renderer has no Node.js integration, rejects permission requests, keeps navigation on the local Harness origin, and sends external HTTP links to the operating system browser.

## Experience

The desktop shell provides a native application window, centered custom title bar, application and tray icons, background operation, local GGUF model setup, and downloadable installers for each supported operating system and architecture.

<p align="center"><img src="assets/screenshots/desktop-home.png" alt="DeepSeek Harness Desktop main window" width="960"></p>

<table>
  <tr>
    <td><img src="assets/screenshots/desktop-first-run.png" alt="First-run local model setup"></td>
    <td><img src="assets/screenshots/desktop-local-model-settings.png" alt="Local model settings"></td>
  </tr>
</table>

## Development

From the repository root, install dependencies and build the Harness before launching the desktop shell:

```sh
pnpm install
pnpm run desktop:dev
```

The backend shares the normal `dsh` home and credentials and uses the user's home directory as its initial working directory. Before backend startup, the desktop launcher migrates the preview-era `agent-presets.default: code` setting to its shipped successor, `standard`; other preset choices remain untouched. The frameless desktop window uses a draggable application title bar with a centered product mark while retaining the platform window controls. Closing the window hides it while the tray process and backend remain available; use the tray menu's **Quit** action or the platform application menu to stop the application.

The first launch offers to download the maintained Qwen3 4B Instruct Q4_K_M GGUF, select an existing `.gguf` file, or postpone setup. Starting the download closes the setup step immediately: the main process continues it while the user explores the application, and the custom title bar plus Models settings show live progress. Closing the window to the tray does not stop the download. The Models settings page and the **Local Model** application and tray menus expose the same model actions later. Downloads live under the application's user-data directory. Selecting a model restarts only the embedded Web-profile process, exposes the `local/local-gguf` route, and selects it for new sessions. Model weights remain on the device; requests use `node-llama-cpp` with Metal, CUDA, Vulkan, or CPU support selected for the installed platform.

## Distribution

Build on the target operating system so Electron and the Harness native dependencies match the artifact:

```sh
pnpm run desktop:dist:mac
pnpm run desktop:dist:win
pnpm run desktop:dist:linux
```

Artifacts are written under `apps/desktop/release`. macOS produces DMG and ZIP files, Windows produces NSIS installers, and Linux produces AppImages. The local commands build the current machine architecture; the repository workflow builds x64 and ARM64 separately on native runners for all three operating-system families. macOS development artifacts use a valid ad-hoc signature so the application can run locally. A trusted public release must replace the configured ad-hoc identity with a Developer ID identity and complete notarization in the release environment.

Pushing a `desktop-v*` tag runs the native build matrix and attaches every installer to a GitHub Release. A manual workflow run builds the same matrix and stores its installers as workflow artifacts without publishing a release.
