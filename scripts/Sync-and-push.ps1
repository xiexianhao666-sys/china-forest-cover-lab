param([Parameter(Mandatory=$true)][string]$Message)
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$workspaceRoot = Split-Path -Parent $repoRoot
$siteSource = Join-Path $workspaceRoot 'outputs/forest-cover-demo'
$apiSource = Join-Path $workspaceRoot 'integrations/appeears'
if (!(Test-Path -LiteralPath (Join-Path $siteSource 'dist/index.html'))) { throw 'Sites source not found.' }
if (!(Test-Path -LiteralPath (Join-Path $apiSource 'appeears.py'))) { throw 'API source not found.' }
Push-Location $repoRoot
try {
    $extensions = @('.html','.css','.js','.json','.geojson','.png','.svg')
    Get-ChildItem -LiteralPath (Join-Path $siteSource 'dist') -File | Where-Object { $_.Extension -in $extensions } | ForEach-Object { Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $repoRoot 'dist') -Force }
    Copy-Item -LiteralPath (Join-Path $siteSource 'qa.cjs') -Destination $repoRoot -Force
    Get-ChildItem -LiteralPath $apiSource -File | Where-Object { $_.Extension -eq '.py' -or $_.Name -in @('README.md','requirements.txt','.gitignore','public-metadata.json','availability.json') } | ForEach-Object { Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $repoRoot 'integrations/appeears') -Force }
    Get-ChildItem -LiteralPath (Join-Path $apiSource 'boundaries') -File | Where-Object { $_.Extension -in @('.json','.geojson') } | ForEach-Object { Copy-Item -LiteralPath $_.FullName -Destination (Join-Path $repoRoot 'integrations/appeears/boundaries') -Force }
    git add --all
    if ($LASTEXITCODE -ne 0) { throw 'Git staging failed.' }
    python scripts/audit_secrets.py
    if ($LASTEXITCODE -ne 0) { throw 'Credential audit failed; push blocked.' }
    git diff --cached --quiet
    if ($LASTEXITCODE -eq 1) {
        git commit -m $Message
        if ($LASTEXITCODE -ne 0) { throw 'Commit failed.' }
    } elseif ($LASTEXITCODE -ne 0) { throw 'Cannot inspect staged changes.' }
    git push origin HEAD
    if ($LASTEXITCODE -ne 0) { throw 'Push failed; local commit retained.' }
    git status --short
} finally { Pop-Location }
