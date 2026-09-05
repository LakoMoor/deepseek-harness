# Agent Note: Mobile preview releases

Status: implemented

[English](2026-09-05-mobile-preview-releases.md) | 中文

## Problem

Android workflow 仅将每个 APK 保留为短期 workflow artifact，因此成功构建后无法从仓库的 Releases 页面获得稳定下载。

## Decision

`mobile-v*` tag 会运行 Android 构建，并在 GitHub prerelease 中发布使用 debug 签名的 APK。release 资产的文件名包含 tag。分支推送和手动运行仍只生成 workflow artifact，不发布 release。

prerelease 标记和文件名中的 `debug` 会明确显示签名状态。production 签名仍位于仓库之外，因为其 upload key 必须保持私密。

## Alternatives considered

**发布每个 `master` 构建。** 这会为每个实现提交创建 release，并使有意发布的版本无法与持续集成输出区分。

**仅保留 workflow artifact。** artifact 会过期且用户更难发现，因此无法提供持久的预览分发路径。

**提交 production upload key。** 共享私有签名密钥会让仓库访问权限同时授予 release 签名权限，因此不可接受。

## Consequences

维护者通过推送明确的 `mobile-v*` tag 创建 Android preview release。用户可以从 Releases 下载 APK，但 Android 会将其视为使用 debug 签名的构建，而不是可信的 production package。
