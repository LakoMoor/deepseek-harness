# Agent Note: React Native Android client owns on-device inference

Status: implemented

English | [中文](2026-09-04-react-native-android-client.zh.md)

## Problem

The Electron application packages a Node runtime and desktop operating-system integrations that Android cannot host directly. A mobile application still needs a useful offline path without duplicating the Cordis backend behind a platform-incompatible process launcher or presenting a partial backend as the full Harness.

## Decision

`apps/mobile` is an independent bare React Native Android application. It owns mobile navigation, first-run setup, private application storage, model download progress, persisted chat messages, and on-device GGUF inference through `llama.rn`. The recommended model is the official Qwen3 0.6B Q8 GGUF, small enough to make the first Android build practical while retaining a standard llama.cpp model format.

The model download runs independently from the visible screen, so navigation does not cancel it and a persistent banner reports progress. A completed download is atomically promoted from a partial file after its HTTP status and minimum size pass validation. The local model remains an explicit user choice during onboarding and in Models and Settings.

The application does not embed the Node/Cordis runtime or claim support for Harness tools, workspaces, plugins, and session protocols. Those capabilities require a separately designed mobile-compatible service protocol; the Android client exposes only behavior it runs on-device.

## Alternatives considered

- **Package Electron or Node inside Android** — Electron has no Android runtime, and embedding an unrelated Node distribution would preserve desktop process assumptions without producing a supported Android application lifecycle.
- **Render the desktop Web UI in a WebView** — a WebView would still need a reachable Harness backend and would not provide the requested offline model path by itself.
- **Port every Harness package into React Native** — the packages depend on Node process, filesystem, and plugin semantics that do not map directly to the React Native runtime; presenting that effort as an initial port would delay a testable mobile application and obscure unsupported capabilities.

## Consequences

Android has a buildable native client with first-run model setup, non-blocking progress, local settings, persisted conversation state, and offline inference after one model download. The app and model add a large native dependency closure and require Android NDK builds. The first slice is intentionally a local chat client rather than feature parity with the desktop Harness; future remote Harness integration needs an authenticated protocol and explicit capability presentation.
