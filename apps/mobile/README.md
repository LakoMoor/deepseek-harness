# DeepSeek Harness Mobile

English | [中文](README.zh.md)

This Android application is a separate bare React Native client under `apps/mobile`. It does not replace or import the Electron shell. The current mobile slice provides private on-device chat through `llama.rn`; the Node and Cordis Harness runtime, tools, workspaces, and plugin composition remain desktop and server capabilities.

## Experience

The first launch offers the official Qwen3 0.6B Q8 GGUF from Hugging Face. The Models screen and Settings expose the same download and removal actions later. Download progress remains visible while the user explores the application, and the completed model is stored in the application's private document directory. Chat messages and the selected language persist locally.

The recommended model is about 640 MB. Inference runs through llama.cpp without an API key after the download completes. Android arm64 devices and x86_64 emulators are included in the build; performance and available memory depend on the device.

## Development

Install JDK 17, Android SDK Platform 37, Build Tools 37.0.0, and NDK 27.1.12297006, then run from the repository root:

```sh
pnpm install
pnpm run mobile:start
pnpm run mobile:android
```

Run the JavaScript checks without an Android device:

```sh
pnpm run mobile:typecheck
pnpm --filter @deepseek-ai/dsh-mobile test --runInBand
```

The Android workflow builds a debug APK for physical arm64 devices and x86_64 emulators and stores it as a workflow artifact. A trusted public release needs a private upload key and a release signing configuration; the repository does not publish a shared signing key.
