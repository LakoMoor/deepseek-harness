# Agent Note: Mobile preview releases

Status: implemented

English | [中文](2026-09-05-mobile-preview-releases.zh.md)

## Problem

The Android workflow retained each APK as a short-lived workflow artifact, so a successful build did not provide a stable download from the repository's Releases page.

## Decision

A `mobile-v*` tag runs the Android build and publishes its debug-signed APK in a GitHub prerelease. The release asset includes the tag in its filename. Branch pushes and manual runs continue to produce workflow artifacts without publishing a release.

The prerelease label and `debug` filename make the signing status visible. Production signing remains outside the repository because its upload key must stay private.

## Alternatives considered

**Publish every `master` build.** This would create a release for every implementation commit and make intentional versions indistinguishable from continuous integration output.

**Keep only workflow artifacts.** Artifacts expire and are harder for users to discover, so they do not provide a durable preview distribution path.

**Commit a production upload key.** A shared private signing key would let repository access grant release-signing authority and is not acceptable.

## Consequences

Maintainers create an Android preview release by pushing an explicit `mobile-v*` tag. Users can download the APK from Releases, but Android treats it as a debug-signed build rather than a trusted production package.
