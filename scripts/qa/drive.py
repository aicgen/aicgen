import os, pty, re, select, sys, time, signal, json
ANSI = re.compile(r'\x1b\[[0-9;?]*[A-Za-z]|\x1b\][^\x07]*\x07|\r')
def run(argv, cwd, env, steps, timeout=60, idle=0.6):
    """steps: list of (regex_to_wait_for, keys_to_send). Returns (transcript, exit_code)."""
    pid, fd = pty.fork()
    if pid == 0:
        os.chdir(cwd); os.execvpe(argv[0], argv, env)
    buf = ''; shown = 0; i = 0; start = time.time(); code = None
    while time.time() - start < timeout:
        r, _, _ = select.select([fd], [], [], 0.2)
        if r:
            try: data = os.read(fd, 65536)
            except OSError: data = b''
            if not data:
                try:
                    _, st = os.waitpid(pid, 0); code = os.waitstatus_to_exitcode(st)
                except ChildProcessError: code = 0
                break
            buf += ANSI.sub('', data.decode('utf-8', 'replace'))
        if i < len(steps):
            pat, keys = steps[i]
            if re.search(pat, buf[shown:], re.S):
                time.sleep(0.25); shown = len(buf)
                os.write(fd, keys.encode()); i += 1
        try:
            p, st = os.waitpid(pid, os.WNOHANG)
            if p:
                code = os.waitstatus_to_exitcode(st)
                # drain
                try:
                    while select.select([fd],[],[],0.2)[0]:
                        d = os.read(fd, 65536)
                        if not d: break
                        buf += ANSI.sub('', d.decode('utf-8','replace'))
                except OSError: pass
                break
        except ChildProcessError: break
    if code is None:
        os.kill(pid, signal.SIGKILL); code = 'TIMEOUT'
    return buf, code, i, len(steps)
if __name__ == '__main__':
    cfg = json.load(open(sys.argv[1]))
    out, code, done, total = run(cfg['argv'], cfg['cwd'], {**os.environ, **cfg.get('env', {})}, [tuple(s) for s in cfg['steps']], cfg.get('timeout', 60))
    print(out[-int(cfg.get('tail', 6000)):]); print(f'\n[exit={code} steps={done}/{total}]')
