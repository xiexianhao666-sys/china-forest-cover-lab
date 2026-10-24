param([Parameter(Mandatory=$true)][string]$Message, [switch]$SkipTests)
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
Push-Location $repoRoot
try {
    $remote = git remote get-url --push origin
    if ($LASTEXITCODE -ne 0 -or $remote -notmatch '^(https://github\.com/|git@github\.com:)xiexianhao666-sys/china-forest-cover-lab(\.git)?$') {
        throw 'origin must target the project GitHub repository, not a local template.'
    }
    if (!$SkipTests) {
        pnpm run check:format
        if ($LASTEXITCODE -ne 0) { throw 'Formatting check failed.' }
        pnpm test
        if ($LASTEXITCODE -ne 0) { throw 'Browser tests failed.' }
        $python = 'python'
        $venvPython = Join-Path $repoRoot 'integrations/appeears/.venv/Scripts/python.exe'
        if (Test-Path -LiteralPath $venvPython) { $python = $venvPython }
        & $python -m unittest discover -s integrations/appeears -p 'test_*.py'
        if ($LASTEXITCODE -ne 0) { throw 'Python tests failed.' }
    }
    git add --all
    if ($LASTEXITCODE -ne 0) { throw 'Git staging failed.' }
    python scripts/audit_secrets.py
    if ($LASTEXITCODE -ne 0) { throw 'Credential audit failed; push blocked.' }
    git diff --cached --check
    if ($LASTEXITCODE -ne 0) { throw 'Staged whitespace check failed.' }
    git diff --cached --quiet
    if ($LASTEXITCODE -eq 1) {
        git commit -m $Message
        if ($LASTEXITCODE -ne 0) { throw 'Commit failed.' }
    } elseif ($LASTEXITCODE -ne 0) { throw 'Cannot inspect staged changes.' }
    git push origin HEAD
    if ($LASTEXITCODE -ne 0) { throw 'Push failed; local commit retained.' }
    git status --short
} finally { Pop-Location }
