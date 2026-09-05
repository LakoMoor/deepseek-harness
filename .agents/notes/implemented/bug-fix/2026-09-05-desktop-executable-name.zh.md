# Agent Note: Desktop executable name

Status: implemented

[English](2026-09-05-desktop-executable-name.md) | 中文

## Problem

Electron Builder 从带 scope 的 npm package 名称推导 executable 名称。Linux AppImage 打包会拒绝生成的 `@deepseek-aidsh-desktop` 值，因为其中包含对文件系统不安全的字符，因此原生 release matrix 无法进入发布 job。

## Decision

desktop package 将 `deepseek-harness` 同时声明为 executable 名称和 Linux desktop identity。Linux desktop-file 同步使用该 identity 将已安装的 launcher 与运行中的窗口关联。

## Alternatives considered

**重命名 npm workspace package。** package 命名遵循仓库统一的 `@deepseek-ai/dsh-*` 约定，不应为了满足 installer 文件名限制而更改。

**禁用 Linux ARM64。** 无效的推导名称影响 Linux 打包而不是 ARM64 支持，因此删除受支持的 release target 只会掩盖配置错误。

## Consequences

AppImage 路径仅包含受支持的字符，Linux 窗口关联使用同一个稳定标识符。面向用户的 product 名称和 installer artifact 名称仍为 `DeepSeek Harness`。
