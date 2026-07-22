; Resonance Inno Setup Script
; Download Inno Setup from https://jrsoftware.org/isinfo.php

#define MyAppName "Resonance"
#define MyAppVersion "0.1.0"
#define MyAppPublisher "Resonance"
#define MyAppURL "https://github.com/pandejesal/resonance"
#define MyAppExeName "resonance.bat"

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

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Files]
Source: "..\release\resonance-backend.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\release\static\*"; DestDir: "{app}\static"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\release\migrations\*"; DestDir: "{app}\migrations"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\release\VERSION"; DestDir: "{app}"; Flags: ignoreversion

[Dirs]
Name: "{app}\data"

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Parameters: "--launch"
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Parameters: "--launch"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Parameters: "--launch"; Description: "Launch Resonance now"; Flags: nowait postinstall skipifsilent

[Code]
// Create launcher exe that starts the backend and opens browser
procedure CreateLauncher;
var
  LaunchFile: TStringList;
begin
  LaunchFile := TStringList.Create;
  try
    LaunchFile.Add('@echo off');
    LaunchFile.Add('cd /d "%~dp0"');
    LaunchFile.Add('set DATABASE_URL=sqlite:%~dp0data\resonance.db');
    LaunchFile.Add('if not exist "data" mkdir data');
    LaunchFile.Add('start /b "" "%~dp0resonance-backend.exe" > nul 2>&1');
    LaunchFile.Add('timeout /t 2 /nobreak > nul');
    LaunchFile.Add('start http://127.0.0.1:8080');
    LaunchFile.SaveToFile(ExpandConstant('{app}\resonance.bat'));
  finally
    LaunchFile.Free;
  end;
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssPostInstall then
  begin
    CreateLauncher;
  end;
end;
