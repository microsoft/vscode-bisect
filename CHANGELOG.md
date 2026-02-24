# Changelog

## Unreleased

- Add support for `exploration` quality builds via `--quality exploration`

## 1.0.17

- Fix launching newer macOS builds that use `Code` / `Code - Insiders` as the executable name instead of `Electron`

## 1.0.16

- Adjust macOS build paths for renamed executable

## 1.0.15

- Use `/tmp` dir on macOS to fix launching signed app bundles after unzipping

## 1.0.14

- Support multiple simultaneous connections when downloading builds
- Support resuming interrupted downloads
- Dependency updates

## 1.0.13

- Allow `--exclude <commit>` to skip specific commits during bisecting

## 1.0.12

- Speed up sanity testing flow on Linux with simplified RPM/DEB selection and automatic Snap inclusion
- Fix sanity testing CLI/Server exit by properly cleaning up Docker containers

## 1.0.11

- Disable experiments when launching desktop builds
- Improve sanity testing flow

## 1.0.10

- Support skipping unsupported installation methods during sanity testing
- Add `safeWriteClipboardSync` to avoid clipboard errors on headless systems
- Polish and style improvements

## 1.0.9

- Support Docker-based CLI testing (`cli-linux-amd64`, `cli-linux-arm64`, `cli-linux-armv7`, `cli-alpine-amd64`, `cli-alpine-arm64`)
- Support Linux installer flavors (`linux-deb`, `linux-rpm`, `linux-snap`)
- Support Windows installer flavors (`win32-user`, `win32-system`)
- Add `--sanity` mode for testing all flavors of a single build

## 1.0.0

- Stable release 🚀
- SHA256 checksum validation for downloaded builds
- Progress bar for downloads
- Allow `--version <major.minor>` to test a specific release version
- Allow `--releasedOnly` to bisect only over published releases
- Retry support when a build fails to start
- macOS universal binary support (`--flavor universal`)

## 0.5.5

- Improve `tryBuild` options for a better bisecting experience

## 0.3.0 – 0.5.4

- Early access and iteration: web local/remote runtimes, performance testing (`--perf`), CLI flavor, ARM support, Windows server spawning fixes, SHA256 validation improvements

## 0.1.0 – 0.2.1

- Initial implementation: desktop bisecting, download with extraction, build caching, interactive prompts
