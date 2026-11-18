"""Drives the real aicgen CLI through its wizard for every language x assistant x level and validates the files it writes.

Usage: bun run build:binary:linux && python3 scripts/qa/matrix.py   (Linux/macOS; needs a pseudo-terminal)
Env: AICGEN_BIN (binary), AICGEN_QA_DIR (work area).
"""
import os, sys, json, re, shutil, tempfile, concurrent.futures as cf
sys.path.insert(0, os.path.dirname(__file__))
from drive import run
HERE = os.path.dirname(os.path.abspath(__file__))
# Work area (projects, throwaway HOME) and the binary under test; override with the environment.
Q = os.environ.get('AICGEN_QA_DIR') or os.path.join(tempfile.gettempdir(), 'aicgen-qa')
BIN = os.environ.get('AICGEN_BIN') or os.path.join(HERE, '..', '..', 'dist', 'aicgen-linux')
HOME = Q + '/home'
os.makedirs(HOME, exist_ok=True)
PROJECTS = {
 'rust': {'Cargo.toml': '[package]\nname = "svc"\nversion = "0.1.0"\nedition = "2024"\n[dependencies]\naxum = "0.8"\n', 'src/main.rs': 'fn main(){}\n'},
 'typescript': {'package.json': '{"name":"svc","version":"1.0.0","dependencies":{"express":"^4"},"devDependencies":{"typescript":"^5","jest":"^29"}}', 'tsconfig.json': '{"compilerOptions":{"strict":true}}', 'src/index.ts': 'export {}\n'},
 'python': {'pyproject.toml': '[project]\nname="svc"\nversion="0.1.0"\ndependencies=["fastapi"]\n', 'app/main.py': 'print(1)\n'},
 'go': {'go.mod': 'module example.com/svc\n\ngo 1.24\n', 'main.go': 'package main\nfunc main(){}\n'},
}
LEVEL_KEYS = {'basic': '\n', 'standard': '\x1b[B\n', 'full': '\x1b[B\x1b[B\n'}
def case(args):
    lang, assistant, level = args
    d = f'{Q}/m/{lang}-{assistant}-{level}'; shutil.rmtree(d, ignore_errors=True)
    for rel, text in PROJECTS[lang].items():
        os.makedirs(os.path.dirname(f'{d}/{rel}'), exist_ok=True); open(f'{d}/{rel}', 'w').write(text)
    steps = [('Use AI', 'n\n'), ('Detected \\w+', '\n'), ('Select project type', '\n'), ('Select architecture pattern', '\n'), ('Select datasource type', '\n'), ('Select instruction level', LEVEL_KEYS[level])]
    out, code, done, total = run([BIN, 'init', '-a', assistant], d, {**os.environ, 'HOME': HOME, 'NO_COLOR': '1'}, steps, timeout=60)
    return {'case': f'{lang}/{assistant}/{level}', 'dir': d, 'exit': code, 'steps': f'{done}/{total}', 'out': out}
def read(p):
    try: return open(p, encoding='utf-8').read()
    except Exception: return None
def fm(text):
    m = re.match(r'^---\n(.*?)\n---\n', text or '', re.S)
    if not m: return None
    d = {}
    for line in m.group(1).split('\n'):
        k, _, v = line.partition(':')
        if _: d[k.strip()] = v.strip().strip('"')
    return d
def validate(r):
    d, assistant, level = r['dir'], r['case'].split('/')[1], r['case'].split('/')[2]
    errs = []; files = []
    for root, _, fs in os.walk(d):
        for f in fs: files.append(os.path.relpath(os.path.join(root, f), d).replace(os.sep, '/'))
    gen = [f for f in files if f not in ('Cargo.toml','go.mod','pyproject.toml','package.json','tsconfig.json','src/main.rs','src/index.ts','app/main.py','main.go')]
    if r['exit'] != 0: errs.append(f"exit={r['exit']}")
    if r['steps'].split('/')[0] != r['steps'].split('/')[1]: errs.append(f"wizard steps {r['steps']}")
    if 'Configuration Generated' not in r['out']: errs.append('no success message')
    if 'Context budget' not in r['out']: errs.append('no budget summary printed')
    if not gen: errs.append('no files generated')
    title = os.path.basename(d)
    main = {'claude-code': 'CLAUDE.md', 'copilot': '.github/copilot-instructions.md', 'antigravity': '.agents/rules/aicgen-instructions.md', 'codex': 'AGENTS.md'}[assistant]
    mt = read(f'{d}/{main}')
    if mt is None: errs.append(f'missing {main}')
    else:
        if 'my-project' in mt: errs.append('main file says my-project')
        if title not in mt and assistant == 'claude-code': errs.append('project name missing from CLAUDE.md')
        if assistant == 'claude-code' and mt.count('\n') > 200: errs.append(f'CLAUDE.md {mt.count(chr(10))} lines')
        if assistant == 'codex' and len(mt.encode()) > 32768: errs.append('AGENTS.md > 32KiB')
    if not os.path.exists(f'{d}/AGENTS.md'): errs.append('missing AGENTS.md')
    for f in gen:
        t = read(f'{d}/{f}')
        if f.endswith('.json'):
            try: json.loads(t)
            except Exception as e: errs.append(f'bad json {f}: {e}')
        if f.endswith('/SKILL.md'):
            m = fm(t); name = f.split('/')[-2]
            if not m: errs.append(f'no frontmatter {f}')
            else:
                if m.get('name') != name: errs.append(f'skill name mismatch {f}')
                if not m.get('description'): errs.append(f'skill no description {f}')
                if len(m.get('name','')) > 64: errs.append(f'skill name too long {f}')
        if f.startswith('.agents/rules/'):
            m = fm(t)
            if not m or 'trigger' not in m: errs.append(f'antigravity rule without trigger {f}')
            if len((t or '').encode()) > 24000: errs.append(f'antigravity rule >24000B {f}')
        if f.startswith('.github/agents/'):
            m = fm(t)
            if not m or not m.get('description'): errs.append(f'copilot agent without description {f}')
        if f.startswith('.claude/rules/'):
            if not (t or '').startswith('---\npaths:'): errs.append(f'claude rule without paths {f}')
        if '.agent/' in f or f.startswith(('.github/chatmodes', '.github/prompts', '.codex/instructions')): errs.append(f'legacy path {f}')
    # no wrong-language examples
    lang = r['case'].split('/')[0]
    foreign = {'rust': ['```typescript', '```python'], 'python': ['```typescript', '```rust'], 'go': ['```typescript', '```python', '```rust'], 'typescript': ['```rust', '```python']}[lang]
    leaked = [f for f in gen if f.endswith('.md') and any(x in (read(f'{d}/{f}') or '') for x in foreign) and not f.startswith(('.claude/agents','.github/agents','.agents/skills/aicgen-security-ai','.claude/skills/aicgen-security-ai'))]
    if leaked and lang != 'typescript': errs.append(f'foreign-language examples in {len(leaked)} files e.g. {leaked[0]}')
    always = len((mt or '').encode()) // 4
    return {'case': r['case'], 'files': len(gen), 'alwaysOnTokens~': always, 'errors': errs}
if __name__ == '__main__':
    combos = [(l, a, v) for l in PROJECTS for a in ['claude-code','copilot','antigravity','codex'] for v in ['basic','standard','full']]
    with cf.ProcessPoolExecutor(8) as ex: results = list(ex.map(case, combos))
    reports = [validate(r) for r in results]
    bad = [x for x in reports if x['errors']]
    os.makedirs(Q, exist_ok=True)
    json.dump(reports, open(Q + '/matrix-report.json', 'w'), indent=1)
    if bad: sys.exit(1)
    print(f'{len(reports)} runs, {len(reports)-len(bad)} clean, {len(bad)} with problems')
    for x in bad[:20]: print(' -', x['case'], x['errors'][:4])
    toks = {}
    for x in reports: toks.setdefault(x['case'].split('/')[1] + '/' + x['case'].split('/')[2], []).append(x['alwaysOnTokens~'])
    print('main-file tokens (min-max) by assistant/level:'); [print('  ', k, min(v), '-', max(v)) for k, v in sorted(toks.items())]
