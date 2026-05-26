; aicgen Installer Script
!include "MUI2.nsh"

; General
Name "aicgen"
OutFile "..\..\dist\aicgen-setup-x64.exe"
Unicode True
InstallDir "$PROGRAMFILES64\aicgen"
InstallDirRegKey HKCU "Software\aicgen" ""
RequestExecutionLevel admin

; Version Information
VIProductVersion "1.2.0.0"
VIAddVersionKey "ProductName" "aicgen"
VIAddVersionKey "CompanyName" "lpsandaruwan"
VIAddVersionKey "LegalCopyright" "© 2025 lpsandaruwan"
VIAddVersionKey "FileDescription" "AI Config Generator Installer"
VIAddVersionKey "FileVersion" "1.2.0.0"

; Icons (Uncomment if .ico files are present in packaging/windows)
; !define MUI_ICON "install.ico"
; !define MUI_UNICON "uninstall.ico"

; UI Interface
!define MUI_ABORTWARNING
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE "..\..\LICENSE"
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_WELCOME
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_UNPAGE_FINISH

!insertmacro MUI_LANGUAGE "English"

; Installer
Section "aicgen (required)" SecCore
  SectionIn RO
  
  SetOutPath "$INSTDIR"
  
  ; Files to install
  File "..\..\dist\aicgen.exe"
  File "..\..\LICENSE"
  File "..\..\README.md"
  
  ; Write Uninstaller
  WriteUninstaller "$INSTDIR\uninstall.exe"
  
  ; Start Menu Shortcuts
  CreateDirectory "$SMPROGRAMS\aicgen"
  CreateShortcut "$SMPROGRAMS\aicgen\aicgen.lnk" "$INSTDIR\aicgen.exe"
  CreateShortcut "$SMPROGRAMS\aicgen\Uninstall.lnk" "$INSTDIR\uninstall.exe"
  
  ; Registry keys for Add/Remove programs
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\aicgen" "DisplayName" "aicgen"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\aicgen" "UninstallString" '"$INSTDIR\uninstall.exe"'
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\aicgen" "Publisher" "lpsandaruwan"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\aicgen" "DisplayVersion" "1.2.0"
  
  ; Add to PATH
  EnVar::SetHKLM
  EnVar::AddValue "path" "$INSTDIR"
SectionEnd

; Uninstaller
Section "Uninstall"
  ; Remove files
  Delete "$INSTDIR\aicgen.exe"
  Delete "$INSTDIR\LICENSE"
  Delete "$INSTDIR\README.md"
  Delete "$INSTDIR\uninstall.exe"
  
  ; Remove shortcuts
  Delete "$SMPROGRAMS\aicgen\aicgen.lnk"
  Delete "$SMPROGRAMS\aicgen\Uninstall.lnk"
  RMDir "$SMPROGRAMS\aicgen"
  
  ; Remove install dir
  RMDir "$INSTDIR"
  
  ; Remove from PATH
  EnVar::SetHKLM
  EnVar::DeleteValue "path" "$INSTDIR"
  
  ; Remove registry keys
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\aicgen"
  DeleteRegKey HKCU "Software\aicgen"
SectionEnd
