$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$npm = if (Get-Command npm.cmd -ErrorAction SilentlyContinue) { 'npm.cmd' } else { 'npm' }
$releaseDir = Join-Path $root 'release'
$tauriExe = Join-Path $root 'src-tauri\target\release\ecommerce-ai-assistant.exe'
$appFileName = [string]::Concat([char]0x7535, [char]0x5546, 'AI', [char]0x52A9, [char]0x624B, '.exe')
$releaseExe = Join-Path $releaseDir $appFileName
$rootExe = Join-Path $root $appFileName

Set-Location $root
& $npm run tauri -- build --no-bundle

New-Item -ItemType Directory -Force -Path $releaseDir | Out-Null
Copy-Item -LiteralPath $tauriExe -Destination $releaseExe -Force

try {
  Copy-Item -LiteralPath $tauriExe -Destination $rootExe -Force
} catch {
  Write-Warning 'The root exe is locked by a running app. Use the release directory copy.'
}

Write-Host "Generated: $releaseExe"
