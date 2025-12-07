# Build Instructions

## Prerequisites

- **Bun** >= 1.0.0 installed ([Download](https://bun.sh))
- Windows, Linux, or macOS

## Quick Build (Current Platform)

```bash
# Navigate to project
cd F:\aicgen\aicgen

# Install dependencies
bun install

# Build standalone executable
bun run build:binary
```

This will create `aicgen.exe` (on Windows) in the project root.

## Build for All Platforms

```bash
# Build for all platforms at once
bun run build:all
```

This creates:
- `aicgen.exe` (Windows)
- `aicgen-linux` (Linux x64)
- `aicgen-macos` (macOS ARM64)

## Step-by-Step Build Process

### 1. Install Dependencies

```bash
bun install
```

### 2. Pre-build (Generate Profile Files)

```bash
bun run prebuild
```

This runs `scripts/prebuild-profiles-chunks.ts` which validates the chunk system.

### 3. Type Check (Optional but Recommended)

```bash
bun run typecheck
```

### 4. Build Binary

**Windows:**
```bash
bun run build:binary:windows
```

**Linux:**
```bash
bun run build:binary:linux
```

**macOS:**
```bash
bun run build:binary:macos
```

## Testing the Binary

### On Windows

```bash
# Test stats command
.\aicgen.exe stats

# Test init with dry-run
.\aicgen.exe init --dry-run

# Test full init (creates files)
.\aicgen.exe init
```

### On Linux/macOS

```bash
# Make executable
chmod +x aicgen-linux

# Test
./aicgen-linux stats
./aicgen-linux init --dry-run
```

## Troubleshooting

### "bun: command not found"

Install Bun:
```bash
# Windows (PowerShell)
powershell -c "irm bun.sh/install.ps1 | iex"

# Linux/macOS
curl -fsSL https://bun.sh/install | bash
```

### "Permission denied" on Linux/macOS

```bash
chmod +x aicgen-linux
```

### Build fails with "Cannot find module"

```bash
# Clean and reinstall
rm -rf node_modules
bun install
bun run build:binary
```

### Type errors

```bash
# Check what's wrong
bun run typecheck

# Often fixed by:
bun install
```

## Development Build (No Binary)

For development without creating a binary:

```bash
# Watch mode (auto-rebuild on changes)
bun run dev

# Run directly with Bun
bun run start init
bun run start stats
```

## File Sizes

Expected binary sizes:
- Windows: ~45-50 MB
- Linux: ~45-50 MB
- macOS: ~45-50 MB

These are standalone executables with Bun runtime embedded.

## Distribution

After building, you can distribute the binary:

1. **Single file** - No dependencies needed
2. **Cross-platform** - Build on any OS for any OS
3. **Fast startup** - Bun's optimized runtime

Share the appropriate binary:
- `aicgen.exe` for Windows users
- `aicgen-linux` for Linux users
- `aicgen-macos` for macOS users

## Next Steps

After building successfully:

```bash
# Move to a directory in your PATH (optional)
# Windows: Copy to C:\Windows\System32 or add to PATH
# Linux/macOS:
sudo mv aicgen-linux /usr/local/bin/aicgen

# Test in any directory
cd ~/some-project
aicgen init
```
