---
applyTo: '**'
---

# VSCode Bisect Project Instructions

## Project Overview
VSCode Bisect is a command-line tool that implements binary search (bisecting) for Visual Studio Code builds to help identify when bugs or performance regressions were introduced. Similar to `git bisect` for code commits, this tool allows users to bisect through released VSCode builds to pinpoint the exact build where an issue first appeared.

## Core Architecture & Design Principles

### 1. **Single Responsibility Components**
- Each module has a clear, focused responsibility:
  - `bisect.ts`: Core bisecting algorithm and user interaction
  - `builds.ts`: Build fetching, caching, and installation management
  - `launcher.ts`: Runtime-specific launching (desktop, web local, web remote)
  - `git.ts`: Git repository management for VS Code source
  - `fetch.ts`: HTTP utilities for downloading builds and metadata
  - `files.ts`: File system operations, unzipping, path management
  - `constants.ts`: Configuration, paths, and platform detection
  - `storage.ts`: Persistent state management

### 2. **Runtime Support**
- **Desktop Local**: Native Electron-based VSCode installations
- **Web Local**: Local web server running VSCode web
- **Web Remote** (`vscode.dev`): Online VSCode instance

### 3. **Cross-Platform Compatibility**
- Supports Windows (x64, ARM), macOS (x64, ARM), Linux (x64, ARM)
- Platform-specific handling for file paths, executable detection, and archive extraction
- Windows path length limitations are considered

### 4. **Caching Strategy**
- Builds are cached in temp directory (`/tmp/vscode-bisect` on Unix, equivalent on Windows)
- SHA256 verification for download integrity
- Persistent storage for bisect state and user preferences

## Development Guidelines

### **Code Style & Standards**
- Use TypeScript strict mode with comprehensive type definitions
- Follow Microsoft's copyright header pattern for all files
- Use `chalk` for colored console output with consistent formatting patterns:
  - `chalk.gray('[component]')` for component prefixes
  - `chalk.green()` for values, commits, versions
  - Error messages should be descriptive and actionable

### **Error Handling**
- Graceful degradation when builds are not available
- Clear error messages that guide users toward solutions
- Fallback to released-only builds when recent builds fail
- Proper cleanup of temporary resources

### **User Experience**
- Interactive prompts using `prompts` library for user decisions
- Progress bars for long-running operations (downloads, launches)
- Verbose logging option for troubleshooting
- Clear status indicators with component prefixes

## API & Integration Points

### **External APIs**
- VSCode Update API: `https://update.code.visualstudio.com/api/`
- GitHub API integration for performance testing (requires token)
- Follows redirects for download URLs

### **File System Structure**
```
/tmp/vscode-bisect/
├── .builds/           # Cached VSCode builds
├── .data/
│   ├── data/         # User data for launched instances
│   └── extensions/   # Extensions folder
├── git/
│   └── vscode/       # Cloned VSCode repository
└── storage.json      # Persistent state
```

## Command Line Interface

### **Command Structure**
- Primary entry point: `npx @vscode/vscode-bisect`
- Uses `commander` for argument parsing
- Support for commit hashes, version numbers, and ranges
- Hidden options for advanced features (performance testing, GitHub tokens)

### **Core Options**
- Runtime selection: `--runtime desktop|web|vscode.dev`
- Commit specification: `--good`, `--bad`, `--commit`, `--version`
- Build filtering: `--releasedOnly` for older builds
- Debugging: `--verbose`, `--reset`

## Testing & Quality Assurance

### **Automated Testing**
- Integration tests using Node.js built-in test runner (`node --test`)
- Test coverage includes:
  - Build fetching and installation across all supported platforms and flavors
  - Cross-platform executable validation
  - Released and unreleased build filtering
- Tests validate functionality across multiple runtime configurations:
  - Desktop Local and Web Local runtimes
  - Stable and Insider quality builds
  - Platform-specific flavors (Default, CLI, Universal for macOS)

### **Manual Testing Approach**
- Tool is designed for interactive testing by developers
- Support for both automated (performance) and manual verification

### **Error Recovery**
- Automatic fallback to released builds when commits not found
- Cache invalidation and rebuild capabilities
- Graceful handling of interrupted bisect sessions

### **Test Execution**
- Run tests with: `npm test`
- Tests require network access for VSCode build API integration
- Cross-platform validation ensures compatibility across Windows, macOS, and Linux

## Dependencies & Ecosystem

### **Core Dependencies**
- Node.js ≥20 required (updated from ≥16)
- TypeScript for type safety and modern JS features
- Node.js built-in test runner for automated testing
- Platform-specific utilities (unzip, process management)
- HTTP client with redirect support

### **External Services**
- VSCode update servers for build metadata and downloads
- GitHub for source repository cloning
- Optional GitHub API for enhanced web testing

## Security Considerations
- SHA256 verification for all downloaded builds
- Temporary directory isolation
- No sensitive data persistence
- Optional GitHub token handling for API access

## Future Development Guidelines

### **When Adding Features**
1. Consider cross-platform implications
2. Maintain the single-responsibility principle for modules
3. Add appropriate error handling and user feedback
4. Update help text and documentation
5. Consider backward compatibility with existing builds

### **When Modifying Build Handling**
1. Verify SHA256 checksums are maintained
2. Test across all supported runtimes
3. Consider disk space implications for caching
4. Ensure proper cleanup of temporary resources

### **When Updating User Interface**
1. Maintain consistent color coding and formatting
2. Provide clear progress indicators for long operations
3. Include troubleshooting hints in error messages
4. Test interactive prompts across different terminals

## Common Patterns

### **Async/Await Usage**
- Consistent use of async/await over Promise chains
- Proper error propagation in async contexts
- Resource cleanup in finally blocks where needed

### **Logging Pattern**
```typescript
console.log(`${chalk.gray('[component]')} message with ${chalk.green('values')}`);
```

### **Error Handling Pattern**
```typescript
if (!result) {
    throw new Error(`Descriptive error with ${chalk.green('context')} and suggestions.`);
}
```

This tool is critical infrastructure for VSCode development workflows and should prioritize stability, usability, and cross-platform compatibility in all modifications.