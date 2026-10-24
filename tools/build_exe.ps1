<#
.SYNOPSIS
  Build a single-file Windows launcher for china-forest-cover-lab.

.DESCRIPTION
  Bundles dist/ into the executable with PyInstaller. Double-clicking the exe
  starts a local static server and opens the default browser.
  Prerequisite: python -m pip install pyinstaller
  Output: tools/release/china-forest-cover-lab-launcher.exe
  Rebuild after dist/ changes; build/ and release/ are gitignored.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File tools\build_exe.ps1
#>
[CmdletBinding()]
param(
    [string]$Python,
    [switch]$Clean
)

$ErrorActionPreference = 'Stop'

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$root = Split-Path -Parent $here
$dist = Join-Path $root 'dist'
$build = Join-Path $here 'build'
$release = Join-Path $here 'release'
$entry = Join-Path $here 'launcher.py'

if (-not (Test-Path (Join-Path $dist 'index.html'))) {
    throw "Missing dist\index.html: $dist"
}
if (-not (Test-Path $entry)) {
    throw "Missing launcher entry: $entry"
}

if (-not $Python) {
    foreach ($candidate in @('python', 'python3')) {
        $found = Get-Command $candidate -ErrorAction SilentlyContinue
        if ($found) { $Python = $found.Source; break }
    }
    if (-not $Python -and (Test-Path 'E:\python\python.exe')) { $Python = 'E:\python\python.exe' }
}
if (-not $Python) {
    throw 'Python 3 not found. Install it or pass -Python <path>.'
}

& $Python -c "import PyInstaller" 2>$null
if ($LASTEXITCODE -ne 0) {
    throw "PyInstaller is not installed for this interpreter: $Python -m pip install pyinstaller"
}

$version = (& $Python -c "import PyInstaller, sys; sys.stdout.write(PyInstaller.__version__)").Trim()
Write-Host "Python     : $Python"
Write-Host "PyInstaller: $version"
Write-Host "dist       : $dist"
Write-Host "output     : $release"
Write-Host ''

$pyArgs = @('-m', 'PyInstaller', '--noconfirm')
if ($Clean) { $pyArgs += '--clean' }
$pyArgs += @(
    '--onefile'
    '--console'
    '--name', 'china-forest-cover-lab-launcher'
    '--add-data', "$dist;dist"
    '--distpath', $release
    '--workpath', $build
    '--specpath', $build
    $entry
)

& $Python @pyArgs
if ($LASTEXITCODE -ne 0) { throw 'PyInstaller build failed.' }

$exe = Join-Path $release 'china-forest-cover-lab-launcher.exe'
if (-not (Test-Path $exe)) { throw "Build finished but exe not found: $exe" }

$sizeMb = [math]::Round((Get-Item $exe).Length / 1MB, 1)
Write-Host ''
Write-Host "Built: $exe ($sizeMb MB)"
Write-Host 'Run it, or verify with:'
Write-Host "  `"$exe`" --self-test"
