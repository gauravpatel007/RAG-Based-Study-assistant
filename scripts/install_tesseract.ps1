Write-Host "Downloading Tesseract eng.traineddata..." -ForegroundColor Cyan
$TessDataDir = "data\tessdata"
if (-Not (Test-Path $TessDataDir)) {
    New-Item -ItemType Directory -Force -Path $TessDataDir | Out-Null
}

$url = "https://github.com/tesseract-ocr/tessdata_fast/raw/main/eng.traineddata"
$outPath = "$TessDataDir\eng.traineddata"

Invoke-WebRequest -Uri $url -OutFile $outPath
Write-Host "eng.traineddata downloaded to $outPath" -ForegroundColor Green

Write-Host "`n[IMPORTANT]" -ForegroundColor Yellow
Write-Host "You must also install the Tesseract OCR engine for Windows."
Write-Host "Download the installer here: https://github.com/UB-Mannheim/tesseract/wiki"
Write-Host "During installation, ensure the installation path (e.g., C:\Program Files\Tesseract-OCR) is added to your system PATH environment variable!"
