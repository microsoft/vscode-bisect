# vscode-bisect
Allows to bisect released VSCode web and desktop builds for issues similar to what `git bisect` does.

Provides additional options to test a specific build by commit hash supporting stable builds as well for sanity testing.

[![Build Status](https://dev.azure.com/monacotools/Monaco/_apis/build/status%2Fnpm%2Fvscode%2Fvscode-bisect?repoName=microsoft%2Fvscode-bisect&branchName=main)](https://dev.azure.com/monacotools/Monaco/_build/latest?definitionId=505&repoName=microsoft%2Fvscode-bisect&branchName=main)

## Requirements

- [Node.js](https://nodejs.org/en/) at least `20.x.x`

## Usage

```sh
npx @vscode/vscode-bisect [ARGS]
```

## Basic Examples

```sh
# Bisect desktop builds interactively
npx @vscode/vscode-bisect

# Test a specific build by commit hash
npx @vscode/vscode-bisect --commit abc1234

# Bisect web builds
npx @vscode/vscode-bisect --runtime web

# Bisect with specific good/bad boundaries
npx @vscode/vscode-bisect --good abc1234 --bad def5678
```

## Excluding Problematic Commits

If you encounter builds that fail to launch or have known issues that interfere with your bisecting, you can exclude them using the `--exclude` option:

```sh
# Exclude a single commit from bisecting
npx @vscode/vscode-bisect --exclude abc1234

# Exclude multiple commits
npx @vscode/vscode-bisect --exclude abc1234 def5678 ghi9012

# Combine with other options
npx @vscode/vscode-bisect --runtime web --exclude abc1234 --good def5678 --bad ghi9012

# Exclude commits when testing a specific version range
npx @vscode/vscode-bisect --good 1.95.0 --bad 1.96.0 --exclude abc1234 def5678
```

### Common scenarios for using `--exclude`:

- **Build failures**: Commits where the build fails to launch or crashes immediately
- **Known broken commits**: Commits with known issues that would interfere with your testing (e.g., broken extensions API, rendering issues)
- **Infrastructure problems**: Builds that failed due to CI/build infrastructure issues rather than code problems

The tool will automatically skip excluded commits and continue bisecting with the remaining builds. You'll see a message indicating how many commits were excluded from the bisect process.

## Help

```sh
npx @vscode/vscode-bisect --help
```

`@vscode/vscode-bisect` is meant to be only used as a command line tool.
