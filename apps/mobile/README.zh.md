# DeepSeek Harness Mobile

[English](README.md) | 中文

此 Android 应用是位于 `apps/mobile` 的独立 bare React Native 客户端。它不会替换或导入 Electron shell。当前 mobile 部分通过 `llama.rn` 提供私密的设备端聊天；Node 与 Cordis Harness runtime、tools、workspaces 和 plugin composition 仍属于 desktop 与 server 能力。

## 使用体验

首次启动会提示从 Hugging Face 下载官方 Qwen3 0.6B Q8 GGUF。之后 Models 页面与 Settings 会提供相同的下载和删除操作。用户浏览应用时下载进度仍保持可见，下载完成的模型保存在应用私有 document directory 中。聊天消息和所选语言保存在本地。

推荐模型约为 640 MB。下载完成后，推理通过 llama.cpp 运行，无需 API key。构建包含 Android arm64 设备和 x86_64 emulator；性能与可用内存取决于设备。

## 开发

安装 JDK 17、Android SDK Platform 37、Build Tools 37.0.0 和 NDK 27.1.12297006，然后从仓库根目录运行：

```sh
pnpm install
pnpm run mobile:start
pnpm run mobile:android
```

无需 Android 设备即可运行 JavaScript checks：

```sh
pnpm run mobile:typecheck
pnpm --filter @deepseek-ai/dsh-mobile test --runInBand
```

Android workflow 会为物理 arm64 设备与 x86_64 emulator 构建 debug APK，并将其保存为 workflow artifact。可信的公开发布需要私有 upload key 与 release signing configuration；仓库不会发布共享 signing key。
