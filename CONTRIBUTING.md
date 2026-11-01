# Contributing to mcp-nvidia-nim

Thank you for your interest in contributing to **mcp-nvidia-nim**! We welcome all contributions: bug fixes, new model integrations, performance optimizations, and documentation improvements.

---

## 🚀 Development Setup

1. **Prerequisites:**
   * **Node.js** `>= 20.x` LTS
   * **pnpm** `>= 10.x` (Mandatory package manager)
   * NVIDIA NIM API Key (`nvapi-...` from [build.nvidia.com](https://build.nvidia.com))

2. **Clone and Install:**
   ```bash
   git clone https://github.com/luizGDpulz/mcp-nvidia-nim.git
   cd mcp-nvidia-nim
   pnpm install
   ```

3. **Configure Environment:**
   ```bash
   cp .env.example .env
   chmod 600 .env
   # Add your NVIDIA_API_KEY to .env
   ```

---

## 🧪 Testing & Validation

Before committing, ensure your code compiles cleanly and passes all unit tests:

```bash
# Typecheck
pnpm run typecheck

# Run unit tests
pnpm test

# Build project
pnpm run build
```

---

## 📋 Git Commit Guidelines

We enforce **Issue-Driven Development** and **Conventional Commits**:

1. **Every contribution must reference an open GitHub Issue:**
   - Link progress commits with `(refs #<id>)`
   - Conclude issues with `(closes #<id>)`

2. **Semantic Types:**
   * `feat: ...` for new features or MCP tools
   * `fix: ...` for bug fixes or concurrency corrections
   * `docs: ...` for documentation and README updates
   * `test: ...` for test suite additions
   * `refactor: ...` for code refactoring without external behavior changes
   * `chore: ...` for dependencies, build tools, or CI workflows

---

## 📥 Submitting a Pull Request

1. Fork the repository and create your feature branch from `main`:
   ```bash
   git checkout -b feat/your-feature-name
   ```
2. Write clean, focused code with atomic commits.
3. Verify that `pnpm run typecheck`, `pnpm test`, and `pnpm run build` pass with zero errors.
4. Push to your fork and submit a Pull Request targeting `main`.
5. Complete the PR template checklist.
