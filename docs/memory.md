# VSCode Bisect Project File Reference

This document serves as a quick reference for understanding what each important file in the VSCode Bisect project does.

## Configuration Files

### `package.json`
- **Purpose**: NPM package configuration and metadata
- **Key Details**:
  - Package name: `@vscode/vscode-bisect`
  - Requires Node.js ≥16
  - Binary entry point: `bin/vscode-bisect`
  - Main scripts: `compile`, `build`, `watch`, `prepare`, `test`
  - Dependencies include: commander, chalk, prompts, simple-git, @vscode/vscode-perf
  - TypeScript-based project with strict type checking
  - Uses Node.js built-in test runner for automated testing

### `tsconfig.json`
- **Purpose**: TypeScript compiler configuration
- **Key Details**:
  - Target: ES2020 with CommonJS modules
  - Source directory: `./src`
  - Output directory: `./out`
  - Strict mode enabled with source maps
  - Excludes node_modules

### `bin/vscode-bisect`
- **Purpose**: Executable entry point for the CLI tool
- **Key Details**:
  - Node.js shebang script
  - Directly requires and executes `../out/index` with process.argv
  - Simple 2-line file that bootstraps the main application

## Core Source Files

### `src/index.ts`
- **Purpose**: Main entry point and CLI argument parsing
- **Key Details**:
  - Uses `commander` for CLI argument parsing
  - Defines all command-line options (runtime, good/bad commits, version, etc.)
  - Handles interactive prompts for missing required arguments
  - Entry point orchestrates the entire bisect process
  - Exports main function that takes argv array
  - Error handling with troubleshooting guidance

### `src/bisect.ts`
- **Purpose**: Core bisecting algorithm and user interaction logic
- **Key Details**:
  - Implements binary search algorithm for build bisection
  - Manages bisect state (currentChunk, currentIndex)
  - Handles user responses (Good, Bad, Quit, Retry, Retry with fresh data dir) for each build test
  - Provides retry options including fresh user data directory cleanup
  - Resolves commit hashes from version strings
  - Orchestrates the bisect workflow from start to finish
  - Provides final results and GitHub link generation
  - Includes cleanUserDataDir() method for clearing cached user data
  - Supports excluding specific commits from bisecting (excludeCommits parameter)

### `src/builds.ts`
- **Purpose**: Build fetching, caching, installation, and metadata management
- **Key Details**:
  - Fetches builds from VSCode update API
  - Handles platform-specific build naming schemes
  - Manages build caching with SHA256 verification
  - Supports version-to-commit resolution
  - Platform-specific archive handling (zip for Windows/macOS, tar.gz for Linux)
  - Build range filtering and validation
  - Complex platform detection for different architectures
  - Supports excluding specific commits from build lists (excludeCommits parameter)

### `src/launcher.ts`
- **Purpose**: Runtime-specific launching of VSCode builds
- **Key Details**:
  - Supports three runtimes: Desktop Local, Web Local, Web Remote
  - Performance testing integration with @vscode/vscode-perf
  - Process management with proper cleanup
  - Platform-specific executable path resolution
  - Command-line argument construction for different runtimes
  - Background process handling for long-running instances

### `src/constants.ts`
- **Purpose**: Configuration constants, paths, and platform detection
- **Key Details**:
  - Defines all temp directory paths (`/tmp/vscode-bisect/`)
  - Platform enumeration (Windows, macOS, Linux with x64/ARM variants)
  - Runtime type definitions (Desktop, Web Local, Web Remote)
  - Performance testing configuration
  - VSCode.dev URL construction
  - Global configuration object (CONFIG)

### `src/git.ts`
- **Purpose**: Git repository management for VSCode source
- **Key Details**:
  - Clones VSCode repository on first use
  - Keeps local repo up-to-date with pulls
  - Uses simple-git library for Git operations
  - Manages git operations in dedicated temp directory
  - Singleton pattern with lazy initialization

### `src/fetch.ts`
- **Purpose**: HTTP utilities for downloading builds and JSON data
- **Key Details**:
  - JSON GET requests with error handling
  - File downloads with progress bars
  - Follows redirects for download URLs
  - Creates parent directories automatically
  - Progress tracking for large file downloads

### `src/files.ts`
- **Purpose**: File system operations, unzipping, and path management
- **Key Details**:
  - Cross-platform file existence checking
  - Build path generation with Windows path length considerations
  - Platform-specific unzip operations (native unzip vs. fflate library)
  - SHA256 checksum computation
  - Archive extraction (zip, tar.gz) with platform-specific handling

### `src/storage.ts`
- **Purpose**: Persistent state management
- **Key Details**:
  - JSON-based storage in temp directory
  - Async initialization with fallback to empty object
  - Key-value store for bisect state and user preferences
  - In-memory caching with disk persistence
  - Type-safe getValue/store methods

### `src/fibonacci.ts`
- **Purpose**: Fibonacci number calculation utilities
- **Key Details**:
  - Exports `fibonacci(n)` function to calculate the nth Fibonacci number
  - Exports `fibonacciSequence(n)` function to generate array of Fibonacci numbers from 0 to n
  - Uses iterative algorithm for efficiency
  - Includes input validation (throws errors for negative numbers and non-integers)
  - 0-indexed: fibonacci(0) = 0, fibonacci(1) = 1, fibonacci(2) = 1, etc.

## Test Files

### `src/tests/integration.test.ts`
- **Purpose**: Integration tests for core functionality
- **Key Details**:
  - Uses Node.js built-in test runner with describe/test functions
  - Tests build fetching and installation across all supported platforms
  - Validates executable path resolution and file system operations
  - Covers multiple runtime configurations (Desktop Local, Web Local)
  - Tests both Stable and Insider quality builds
  - Includes platform-specific flavor testing (Default, CLI, Universal for macOS)
  - Validates both released-only and unreleased build filtering
  - Tests exclude commits functionality to ensure excluded commits are properly filtered
  - Requires network access for VSCode build API integration

### `src/tests/fibonacci.test.ts`
- **Purpose**: Unit tests for Fibonacci calculation functions
- **Key Details**:
  - Uses Node.js built-in test runner with describe/test functions
  - Tests `fibonacci()` function with base cases (0, 1), small and large indices
  - Tests `fibonacciSequence()` function for correct sequence generation
  - Validates error handling for negative numbers and non-integer inputs
  - Does not require network access (pure unit tests)

## Documentation Files

### `README.md`
- **Purpose**: User-facing documentation and usage instructions
- **Key Details**:
  - Installation instructions via npx
  - Basic usage examples
  - Requirements (Node.js ≥20)
  - Link to help command

### `docs/memory.md` (this file)
- **Purpose**: Internal project reference for AI assistants
- **Key Details**:
  - File-by-file breakdown of project structure
  - Quick reference for understanding codebase
  - Referenced by project rules for context

## Build & CI Files

### `build/pipeline.yml`
- **Purpose**: Azure DevOps CI/CD pipeline configuration
- **Key Details**:
  - Automated build and test processes
  - Integration test execution as part of CI/CD
  - Publish workflow for NPM package
  - Cross-platform testing matrix
