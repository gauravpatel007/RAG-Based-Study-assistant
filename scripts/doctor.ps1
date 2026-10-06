Write-Host "Running Study Assistant Health Checks..." -ForegroundColor Cyan

$allPass = $true

function Test-Command {
    param([string]$cmd, [string]$args, [string]$name)
    try {
        $out = Invoke-Expression "$cmd $args" 2>&1
        Write-Host "[OK] $name found" -ForegroundColor Green
        return $true
    } catch {
        Write-Host "[FAIL] $name not found or not in PATH" -ForegroundColor Red
        $global:allPass = $false
        return $false
    }
}

Test-Command "python" "--version" "Python"
Test-Command "node" "--version" "Node.js"
Test-Command "npm" "--version" "npm"
Test-Command "tesseract" "--version" "Tesseract OCR"

# Check PostgreSQL port
Write-Host "Checking PostgreSQL on port 5432..."
$tcp = New-Object System.Net.Sockets.TcpClient
try {
    $tcp.Connect("127.0.0.1", 5432)
    Write-Host "[OK] PostgreSQL port 5432 is reachable" -ForegroundColor Green
} catch {
    Write-Host "[FAIL] Cannot connect to PostgreSQL on 127.0.0.1:5432" -ForegroundColor Red
    $global:allPass = $false
} finally {
    if ($tcp.Connected) { $tcp.Close() }
}

# Check Ollama
Write-Host "Checking Ollama..."
try {
    $response = Invoke-RestMethod -Uri "http://127.0.0.1:11434/" -Method Get -ErrorAction Stop
    if ($response -match "Ollama is running") {
        Write-Host "[OK] Ollama is running" -ForegroundColor Green
    } else {
        Write-Host "[FAIL] Ollama responded but not as expected" -ForegroundColor Red
        $global:allPass = $false
    }
} catch {
    Write-Host "[FAIL] Cannot connect to Ollama on 127.0.0.1:11434. Is it started?" -ForegroundColor Red
    $global:allPass = $false
}

if ($allPass) {
    Write-Host "`nAll prerequisite checks passed!" -ForegroundColor Green
} else {
    Write-Host "`nSome checks failed. Please review the errors above." -ForegroundColor Red
}
