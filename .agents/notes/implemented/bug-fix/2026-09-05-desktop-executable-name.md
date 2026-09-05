# Agent Note: Desktop executable name

Status: implemented

English | [中文](2026-09-05-desktop-executable-name.zh.md)

## Problem

Electron Builder derived the executable name from the scoped npm package name. Linux AppImage packaging rejects the resulting `@deepseek-aidsh-desktop` value because it contains filesystem-unsafe characters, so the native release matrix could not reach its publication job.

## Decision

The desktop package declares `deepseek-harness` as both its executable name and Linux desktop identity. Linux desktop-file synchronization uses that identity to associate installed launchers with running windows.

## Alternatives considered

**Rename the npm workspace package.** Package naming follows the repository-wide `@deepseek-ai/dsh-*` convention and should not be changed to satisfy an installer filename constraint.

**Disable Linux ARM64.** The invalid derived name affects Linux packaging rather than ARM64 support, so removing a supported release target would hide the configuration error.

## Consequences

AppImage paths contain only supported characters and Linux window association uses the same stable identifier. The user-facing product name and installer artifact names remain `DeepSeek Harness`.
