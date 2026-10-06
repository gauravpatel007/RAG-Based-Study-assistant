Write-Host "Downloading Inter font files..." -ForegroundColor Cyan

$FontDir = "frontend\public\fonts"
if (-Not (Test-Path $FontDir)) {
    New-Item -ItemType Directory -Force -Path $FontDir | Out-Null
}

$fontUrl = "https://github.com/rsms/inter/releases/download/v4.0/Inter-4.0.zip"
$zipPath = "$FontDir\Inter.zip"

Write-Host "Downloading $fontUrl ..."
Invoke-WebRequest -Uri $fontUrl -OutFile $zipPath

Write-Host "Extracting fonts..."
Expand-Archive -Path $zipPath -DestinationPath "$FontDir\extracted" -Force

Write-Host "Copying WOFF2 files..."
Copy-Item -Path "$FontDir\extracted\extras\web\*woff2" -Destination $FontDir -Force

Write-Host "Cleaning up..."
Remove-Item -Path $zipPath -Force
Remove-Item -Path "$FontDir\extracted" -Recurse -Force

Write-Host "Fonts downloaded successfully to $FontDir" -ForegroundColor Green
