param([Parameter(Mandatory=$true)][ValidateSet('chroma','api','worker','frontend')][string]$Service)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$backendRoot = Join-Path $projectRoot 'backend'
$pythonExe = Join-Path $backendRoot '.venv\Scripts\python.exe'
$chromaExe = Join-Path $backendRoot '.venv\Scripts\chroma.exe'
$env:PYTHONPATH = $backendRoot
$env:PYTHONUNBUFFERED = '1'
Set-Location -LiteralPath $projectRoot
$logDirectory = Join-Path $projectRoot 'data\logs'
New-Item -ItemType Directory -Force -Path $logDirectory | Out-Null
Start-Transcript -Path (Join-Path $logDirectory ($Service + '.log')) -Append | Out-Null
try {
    # Resolve configuration once using the same absolute .env path as the API.
    $chromaConfig = (& $pythonExe -m app.service_config) | ConvertFrom-Json
    if ($LASTEXITCODE -ne 0) { throw 'Could not load project settings.' }
    while ($true) {
        switch ($Service) {
            'chroma' { 
                $env:CHROMA_PORT_TMP = $chromaConfig.port
                $env:CHROMA_PATH_TMP = $chromaConfig.path
                & $pythonExe -c "from chromadb.cli.cli import app; import os, sys; sys.argv=['chroma', 'run', '--host', '0.0.0.0', '--port', os.environ['CHROMA_PORT_TMP'], '--path', os.environ['CHROMA_PATH_TMP']]; app()" 
            }
            'api' { & $pythonExe -m uvicorn app.main:app --reload --reload-dir $backendRoot --host 127.0.0.1 --port 8000 }
            'worker' { & $pythonExe -m app.worker }
            'frontend' {
                Push-Location -LiteralPath (Join-Path $projectRoot 'frontend')
                try { & npm.cmd run dev } finally { Pop-Location }
            }
        }
        Write-Host "$Service exited ($LASTEXITCODE); restarting in 3 seconds."
        Start-Sleep -Seconds 3
    }
} finally { Stop-Transcript | Out-Null }
