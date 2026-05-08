$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$releaseDir = Join-Path $root 'release'
$appFileName = [string]::Concat([char]0x7535, [char]0x5546, 'AI', [char]0x52A9, [char]0x624B, '.exe')
$zipFileName = [string]::Concat([char]0x7535, [char]0x5546, 'AI', [char]0x52A9, [char]0x624B, '.zip')
$releaseExe = Join-Path $releaseDir $appFileName
$zipPath = Join-Path $releaseDir $zipFileName

Set-Location $root
& (Join-Path $PSScriptRoot 'release-exe.ps1')

if (Test-Path $zipPath) {
  Remove-Item -LiteralPath $zipPath -Force
}

Compress-Archive -LiteralPath $releaseExe -DestinationPath $zipPath
Write-Host "Generated: $zipPath"
