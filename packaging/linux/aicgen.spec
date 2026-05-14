Name:       aicgen
Version:    1.1.0
Release:    1%{?dist}
Summary:    AI Config Generator
License:    MIT
URL:        https://github.com/lpsandaruwan/aicgen
Source0:    aicgen-linux

%description
AI-assisted configuration generator for better coding.
Automatically analyzes your project and suggests optimal configurations.

%install
mkdir -p %{buildroot}/usr/bin
cp %{SOURCE0} %{buildroot}/usr/bin/aicgen
chmod 755 %{buildroot}/usr/bin/aicgen

%files
/usr/bin/aicgen

%changelog
* Wed May 14 2026 Lahiru Sandaruwan <lpsandaruwan@gmail.com> - 1.1.0-1
- Add SDLC workflow slash commands (/spec, /research, /plan, /build, /check, /ship) injected into all assistant configs

* Thu Dec 11 2025 Lahiru Sandaruwan <lpsandaruwan@gmail.com> - 1.0.0-1
- Initial release
