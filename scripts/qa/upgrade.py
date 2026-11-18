"""Real upgrade test: aicgen 1.2.0 generates `full` output over a project with the user's own files, then this build upgrades it.
Checks every 1.x file is removed, nothing is left over or missing, and user files are untouched.

Run matrix.py first (its output is the clean 2.0 baseline), then:
  AICGEN_OLD_BIN=/path/to/aicgen-1.2.0 python3 scripts/qa/upgrade.py
"""
import os, sys, json, shutil, concurrent.futures as cf
sys.path.insert(0,'.')
from drive import run
import matrix
Q = matrix.Q
OLD_BIN = os.environ.get('AICGEN_OLD_BIN')
if not OLD_BIN: sys.exit('Set AICGEN_OLD_BIN to an aicgen 1.2.0 binary (build the v1.2.0 tag with its own data).')
os.makedirs(Q + '/home-old', exist_ok=True)
ENV_OLD = {**os.environ, 'HOME': Q + '/home-old', 'NO_COLOR': '1', 'CI': '1'}
ENV_NEW = {**os.environ, 'HOME': Q + '/home', 'NO_COLOR': '1'}
IDX = {'claude-code': 0, 'copilot': 1, 'antigravity': 2, 'codex': 3}
USER_FILES = {
    '.github/prompts/my-own.prompt.md': 'USER PROMPT', '.github/instructions/team.instructions.md': 'USER INSTR',
    '.claude/skills/mine/SKILL.md': 'USER SKILL', '.claude/agents/mine.md': 'USER AGENT', '.agent/rules/mine.md': 'USER RULE',
    '.agents/skills/mine/SKILL.md': 'USER SKILL2', '.github/skills/mine/SKILL.md': 'USER SKILL3', 'docs/notes.md': 'NOTES',
}
def tree(d):
    out = set()
    for r, _, fs in os.walk(d):
        for f in fs: out.add(os.path.relpath(os.path.join(r, f), d).replace(os.sep, '/'))
    return out
def one(args):
    lang, assistant = args
    d = f'{Q}/up/{lang}-{assistant}'; shutil.rmtree(d, ignore_errors=True)
    for rel, text in {**matrix.PROJECTS[lang], **USER_FILES}.items():
        os.makedirs(os.path.dirname(f'{d}/{rel}'), exist_ok=True); open(f'{d}/{rel}', 'w').write(text)
    base_user = tree(d)
    wiz = lambda last: [('Use AI', 'n\n'), ('Detected \\w+', '\n'), ('Select project type', '\n'), ('Select architecture pattern', '\n'), ('Select datasource type', '\n'), ('Select instruction level', '\x1b[B\x1b[B\n')] + last
    out1, c1, s1, t1 = run([OLD_BIN, 'init', '-a', assistant], d, ENV_OLD, wiz([('(Which coding assistant|Select (target )?assistant|Which AI assistant)', '\x1b[B' * IDX[assistant] + '\n'), ('How would you like to proceed', '\n')]), 60)
    after_old = tree(d)
    out2, c2, s2, t2 = run([matrix.BIN, 'init', '-a', assistant], d, ENV_NEW, wiz([('How would you like to proceed', '\n')]), 60)
    after_new = tree(d); clean = tree(f'{Q}/m/{lang}-{assistant}-full')  # needs a prior matrix.py run
    expected = clean | base_user
    old_only = sorted(after_old - base_user - clean)
    return dict(case=f'{lang}/{assistant}', old_exit=c1, old_steps=f'{s1}/{t1}', old_files=len(after_old - base_user), new_exit=c2,
                old_only=old_only, removed=[f for f in old_only if f not in after_new], leftovers=sorted(after_new - expected),
                missing=sorted(expected - after_new),
                user_intact=all(os.path.exists(f'{d}/{r}') and open(f'{d}/{r}').read() == t for r, t in USER_FILES.items()),
                notice='aicgen 1.x file' in out2, removal_notice='previous profile' in out2, tail1=out1[-300:])
if __name__ == '__main__':
    combos = [(l, a) for l in ['typescript', 'python', 'go'] for a in IDX]
    with cf.ProcessPoolExecutor(6) as ex: res = list(ex.map(one, combos))
    for r in res:
        print(f"{r['case']:24} 1.2.0 exit={r['old_exit']} steps={r['old_steps']} files={r['old_files']:3} | 2.0 exit={r['new_exit']} 1.x-only={len(r['old_only']):3} removed={len(r['removed']):3} LEFTOVER={len(r['leftovers'])} missing={len(r['missing'])} user={r['user_intact']} notice={r['notice']}")
    json.dump(res, open(Q + '/upgrade-report.json', 'w'), indent=1)
