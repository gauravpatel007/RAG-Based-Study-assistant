param([ValidateSet('chroma','api','worker','frontend')][string[]]$Services = @('chroma','api','worker','frontend'))
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$statePath = Join-Path $projectRoot 'data\dev-processes.json'
$records = @()
if (Test-Path -LiteralPath $statePath) {
    $records = @(Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json) |
        Where-Object { $_.service -and $_.id -and $_.started }
}
$allProcesses = @(Get-CimInstance Win32_Process)
function Stop-ServiceTree([int]$processId) {
    # Stop the supervisor first so it cannot respawn a child during shutdown.
    Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
    foreach ($child in $allProcesses | Where-Object { $_.ParentProcessId -eq $processId }) {
        Stop-ServiceTree $child.ProcessId
    }
}
foreach ($record in $records) {
    if ($record.service -notin $Services) { continue }
    $serviceProcess = Get-Process -Id $record.id -ErrorAction SilentlyContinue
    $command = $allProcesses | Where-Object { $_.ProcessId -eq $record.id }
    if ($serviceProcess -and $command.CommandLine -like '*run-service.ps1*' -and
        $command.CommandLine.Contains($projectRoot) -and
        [Math]::Abs(($serviceProcess.StartTime.ToUniversalTime() - ([DateTime]$record.started).ToUniversalTime()).TotalSeconds) -lt 2) {
        Stop-ServiceTree $record.id
    }
}
# Recover project supervisors omitted by an overwritten/older tracking file.
# Match the exact script path and requested service; never stop unrelated Python.
$runnerPath = Join-Path $PSScriptRoot 'run-service.ps1'
foreach ($service in $Services) {
    $runnerPattern = '-File\s+"?' + [regex]::Escape($runnerPath) + '"?\s+-Service\s+' + [regex]::Escape($service) + '(?:\s|$)'
    foreach ($runner in $allProcesses | Where-Object {
        $_.Name -in @('powershell.exe', 'pwsh.exe') -and $_.CommandLine -match $runnerPattern
    }) {
        Stop-ServiceTree $runner.ProcessId
    }
}
$remaining = @($records | Where-Object { $_.service -notin $Services })
if ($remaining.Count) { ConvertTo-Json -InputObject $remaining | Set-Content -LiteralPath $statePath }
elseif (Test-Path -LiteralPath $statePath) { Remove-Item -LiteralPath $statePath }
Write-Host 'Stopped this project''s tracked services.'
