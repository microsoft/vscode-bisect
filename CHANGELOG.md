# Changelog

## 1.0.17

### New Features

- **Exploration quality support**: Added `exploration` as a new quality option alongside `insider` and `stable`. Use `--quality exploration` to bisect or test VS Code Exploration builds.
  - `vscode.dev` URLs use the `exploration.vscode.dev` subdomain
  - Desktop app names resolved to `Visual Studio Code - Exploration.app` (macOS), `Code - Exploration.exe` (Windows), `code-exploration` (Linux)
  - CLI binary resolved to `code-exploration`
  - Server binaries resolved to `code-server-exploration`
  - Build cache folder prefixed with `exploration-` to avoid collisions with other qualities
  - Linux package installer commands use `code-exploration` package name
  - Windows installer paths resolve to `Microsoft VS Code Exploration` folder
