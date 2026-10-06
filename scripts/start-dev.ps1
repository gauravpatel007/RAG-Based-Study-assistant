param([switch]$NoWindow, [switch]$ShowWindows,
    [ValidateSet('chroma','api','worker','frontend')][string[]]$Services = @('chroma','api','worker','frontend'))
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$statePath = Join-Path $projectRoot 'data\dev-processes.json'
$serviceScript = Join-Path $PSScriptRoot 'run-service.ps1'
& (Join-Path $PSScriptRoot 'stop-dev.ps1') -Services $Services
New-Item -ItemType Directory -Force -Path (Join-Path $projectRoot 'data') | Out-Null
$records = @()
if (Test-Path -LiteralPath $statePath) { $records = @(Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json) }
foreach ($service in $Services | Select-Object -Unique) {
    $processOptions = @{
        FilePath = 'powershell.exe'
        ArgumentList = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ('"' + $serviceScript + '"'), '-Service', $service)
        WorkingDirectory = $projectRoot
        WindowStyle = 'Hidden'
        PassThru = $true
    }
    if ($ShowWindows -and -not $NoWindow) { $processOptions.WindowStyle = 'Normal' }
    $serviceProcess = Start-Process @processOptions
    $records += @{ id = $serviceProcess.Id; service = $service; started = $serviceProcess.StartTime.ToUniversalTime().ToString('o') }
    ConvertTo-Json -Depth 5 -InputObject $records | Set-Content -LiteralPath $statePath
}
Write-Host 'Development services launched. Logs: data\logs'
Write-Host 'Frontend: http://localhost:5169'
Write-Host 'Check scripts\doctor.ps1 for readiness.'
