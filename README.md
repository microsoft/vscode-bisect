# vscode-bisect
Allows to bisect released VSCode web and desktop insider builds for issues similar to what `git bisect` does.

[![Build Status](https://dev.azure.com/monacotools/Monaco/_apis/build/status%2Fnpm%2Fvscode%2Fvscode-bisect?repoName=microsoft%2Fvscode-bisect&branchName=main)](https://dev.azure.com/monacotools/Monaco/_build/latest?definitionId=505&repoName=microsoft%2Fvscode-bisect&branchName=main)

## Requirements

- [Node.js](https://nodejs.org/en/) at least `16.x.x`

## Usage

```sh
npx @vscode/vscode-bisect [ARGS]
```

## Help

```sh
npx @vscode/vscode-bisect --help
```

`@vscode/vscode-bisect` is meant to be only used as a command line tool.
