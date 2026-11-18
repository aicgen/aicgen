# CLI QA harness

End-to-end checks that drive the **real compiled CLI** through its interactive wizard in a pseudo-terminal
(Linux/macOS), using a throwaway `HOME` so nothing in your own configuration is touched.

| Script | What it checks |
|--------|----------------|
| `matrix.py` | 4 languages x 4 assistants x 3 levels (48 runs): wizard completes, files are valid (frontmatter, names, JSON, size limits), the project name is used, no foreign-language examples |
| `upgrade.py` | Genuine aicgen 1.2.0 output upgraded in place by this build: 1.x files removed, none left over, user files untouched |

```bash
bun run build:binary:linux
python3 scripts/qa/matrix.py
# Optional: build the v1.2.0 tag with its own data, then
AICGEN_OLD_BIN=/path/to/aicgen-1.2.0 python3 scripts/qa/upgrade.py
```

Environment: `AICGEN_BIN` (binary under test, default `dist/aicgen-linux`), `AICGEN_QA_DIR` (work area, default the system temp dir).
Both scripts exit non-zero on problems. They answer the wizard by prompt text, so update the patterns if prompts are reworded.
