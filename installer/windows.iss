; Resonance Inno Setup Script
; Builds the Windows standalone server installer (v0.8.0, per-user install).
; Requires: Inno Setup 6 (https://jrsoftware.org/isinfo.php)
; Expects a populated `release\` dir:
;   release\resonance-backend.exe  release\static\*  release\VERSION

#define MyAppName "Resonance"
#define MyAppVersion "0.8.0"
#define MyAppPublisher "Resonance"
#define MyAppURL "https://github.com/pandejesal/resonance"
#define MyAppExeName "resonance.bat"
#define MyAppVbsName "resonance-launch.vbs"
#define MyDataDir "{userappdata}\Resonance"

[Setup]
AppId={{A1B2C3D4-E5F6-7890-ABCD-EF1234567890}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName={autopf}\Resonance
DefaultGroupName={#MyAppName}
AllowNoIcons=yes
OutputDir=installer_output
OutputBaseFilename=resonance-{#MyAppVersion}-windows-setup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
CloseApplications=no
; data lives in {userappdata}\Resonance (outside {app}) -> uninstaller keeps it
UninstallDisplayName={#MyAppName}

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked
Name: "autostart"; Description: "Start Resonance when I log in"; GroupDescription: "Startup:"; Flags: unchecked

[Files]
Source: "..\release\resonance-backend.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\release\static\*"; DestDir: "{app}\static"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\release\VERSION"; DestDir: "{app}"; Flags: ignoreversion

[Dirs]
Name: "{#MyDataDir}"

[Registry]
; Per-user login autostart (hidden launch via VBS)
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Run"; \
  ValueType: string; ValueName: "Resonance"; \
  ValueData: "wscript.exe ""{app}\{#MyAppVbsName}"""; \
  Flags: uninsdeletevalue; Tasks: autostart

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Parameters: "--launch"
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Parameters: "--launch"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppVbsName}"; Description: "Launch Resonance now"; Flags: nowait postinstall skipifsilent

[Code]
// Creates the batch launcher (starts backend, opens app-mode window) and a
// hidden VBS wrapper used by the autostart Run key (no console flash).
procedure CreateLauncher;
var
  BatFile, VbsFile: TStringList;
  AppDir, DataDir: string;
begin
  AppDir := ExpandConstant('{app}');
  DataDir := ExpandConstant('{#MyDataDir}');

  BatFile := TStringList.Create;
  try
    BatFile.Add('@echo off');
    BatFile.Add('cd /d "' + AppDir + '"');
    BatFile.Add('set DATABASE_URL=sqlite:' + DataDir + '\resonance.db');
    BatFile.Add('if not exist "' + DataDir + '" mkdir "' + DataDir + '"');
    BatFile.Add('rem Start the server if it is not already running');
    BatFile.Add('tasklist /fi "imagename eq resonance-backend.exe" 2>nul | find /i "resonance-backend.exe" >nul || start /b "" "' + AppDir + '\resonance-backend.exe" > nul 2>&1');
    BatFile.Add('timeout /t 2 /nobreak > nul');
    BatFile.Add('rem Open the app-mode browser window (Edge/Chrome), fallback to default browser');
    BatFile.Add('set "BROWSER="');
    BatFile.Add('if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" set "BROWSER=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"');
    BatFile.Add('if not defined BROWSER if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" set "BROWSER=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"');
    BatFile.Add('if not defined BROWSER if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set "BROWSER=%ProgramFiles%\Google\Chrome\Application\chrome.exe"');
    BatFile.Add('if not defined BROWSER if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set "BROWSER=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"');
    BatFile.Add('if defined BROWSER (start "" "%BROWSER%" --app=http://127.0.0.1:8080) else (start http://127.0.0.1:8080)');
    BatFile.SaveToFile(AppDir + '\resonance.bat');
  finally
    BatFile.Free;
  end;

  VbsFile := TStringList.Create;
  try
    VbsFile.Add('Set shell = CreateObject("WScript.Shell")');
    VbsFile.Add('shell.Run """" & CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName) & "\resonance.bat"", 0, False');
    VbsFile.SaveToFile(AppDir + '\resonance-launch.vbs');
  finally
    VbsFile.Free;
  end;
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssPostInstall then
  begin
    CreateLauncher;
  end;
end;
