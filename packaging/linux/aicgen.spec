Name:       aicgen
Version:    1.2.0
Release:    1%{?dist}
Summary:    AI Config Generator
License:    MIT
URL:        https://github.com/aicgen/aicgen
Source0:    aicgen-linux

%description
AI coding profile generator for Claude Code, GitHub Copilot, Antigravity, and Codex.
Generates profile-aware instructions, workflows, skills, hooks, and local plugin files.

%install
mkdir -p %{buildroot}/usr/bin
cp %{SOURCE0} %{buildroot}/usr/bin/aicgen
chmod 755 %{buildroot}/usr/bin/aicgen

%files
/usr/bin/aicgen

%changelog
* Tue May 26 2026 Lahiru Sandaruwan <lpsandaruwan@gmail.com> - 1.2.0
- Add agentic profile outputs for Claude Code, Copilot, Antigravity, and Codex
- Embed data from the local data submodule

* Wed May 14 2026 Lahiru Sandaruwan <lpsandaruwan@gmail.com> - 1.1.1
- Add SDLC workflow slash commands (/spec, /research, /plan, /build, /check, /ship) injected into all assistant configs

* Thu Dec 11 2025 Lahiru Sandaruwan <lpsandaruwan@gmail.com> - 1.0.0-1
- Initial release
