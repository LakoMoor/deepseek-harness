# DeepSeek Harness

English | [中文](README.zh.md)

DeepSeek Harness (`dsh`) is an open-source agent harness developed by [DeepSeek AI](https://deepseek.com).

It is built on an **everything-is-a-plugin** architecture and powered by [Cordis](https://github.com/cordiverse/cordis), whose design is described in [_A Programming Paradigm for Spatiotemporal Composability_](https://arxiv.org/abs/2608.25512).

Documentation: [https://deepseek-harness.github.io/deepseek-harness/](https://deepseek-harness.github.io/deepseek-harness/)

## Desktop edition

The desktop edition maintained by [LakoMoor](https://github.com/LakoMoor) packages the Harness as an installable macOS, Windows, and Linux application while preserving the complete Web UI and plugin system.

<p align="center"><img src="apps/desktop/assets/screenshots/desktop-home.png" alt="DeepSeek Harness Desktop main window" width="960"></p>

### Desktop highlights

- Run with a native window, custom title bar, application icon, tray controls, and background backend lifecycle.
- Download the recommended local model during first-run setup or choose any compatible GGUF file later in Settings.
- Keep exploring the application while a model downloads; progress remains visible in the title bar and Models settings.
- Run local conversations through `node-llama-cpp` with Metal, CUDA, Vulkan, or CPU support selected for the platform.
- Build native x64 and ARM64 installers for macOS, Windows, and Linux through GitHub Actions.

<table>
  <tr>
    <td><img src="apps/desktop/assets/screenshots/desktop-first-run.png" alt="First-run local model setup"></td>
    <td><img src="apps/desktop/assets/screenshots/desktop-local-model-settings.png" alt="Local model settings"></td>
  </tr>
</table>

See the [desktop guide](apps/desktop/README.md) for development, packaging, and release instructions.

## Developer preview

DeepSeek Harness is in _developer preview_ and iterating rapidly. **THERE WILL BE COMPATIBILITY-BREAKING CHANGES.**

Review the [safety notice](SAFETY.md) before running the project.

## Run

### Run from `npm`

Install `Node.js`, then run:

```sh
npx @deepseek-ai/dsh web
```

The command starts the Web UI at `http://127.0.0.1:3080` by default and opens it in the default browser for a local launch. An SSH launch only prints the host URL because the SSH client or editor owns the local forwarded address. Pass `--no-open` to run the server without opening a browser. See [Web UI guide](docs/user/guide/index.md).

### Run from source

To run from a repository checkout:

```sh
git clone https://github.com/LakoMoor/deepseek-harness.git
cd deepseek-harness
pnpm install
pnpm run build
pnpm dsh web
```

`pnpm run build` prepares the repository artifacts. `pnpm dsh web` uses those built artifacts without rebuilding.

## Community and support

- Submit feedback or bug reports through [GitHub Discussions](https://github.com/deepseek-ai/deepseek-harness/discussions).
- Add the [`dsh-plugin`](https://github.com/topics/dsh-plugin) topic to your plugin repository for discoverability.
- Join <a href="https://discord.gg/Ycq5dCaS4">DeepSeek Harness Discord community</a>.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Development

Start with the [development guide](docs/development.md) and [architecture documentation](docs/architecture.md).

For agents, follow [AGENTS.md](AGENTS.md).

## License

[MIT](LICENSE)

Third-party dependencies and their licenses are disclosed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
