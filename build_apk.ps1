$ErrorActionPreference = 'Stop'
$Src = "C:\Users\7rc10\OneDrive\Desktop\poki\lost-found-nfc"
$Dst = "C:\temp_nfc_build"

Write-Host "Cleaning up $Dst..."
if (Test-Path $Dst) {
    # Workaround for locked files: rename then delete or just force delete
    Remove-Item -Path $Dst -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host "Copying files via robocopy..."
& robocopy $Src $Dst /MIR /XD node_modules .git android\app\build android\.gradle android\.cxx
if ($LASTEXITCODE -ge 8) {
    throw "Robocopy failed with exit code $LASTEXITCODE"
}

Write-Host "Setting location to $Dst..."
Set-Location $Dst

Write-Host "Installing npm dependencies..."
npm install

Write-Host "Setting location to android..."
Set-Location android

Write-Host "Starting Gradle build..."
$env:SENTRY_DISABLE_AUTO_UPLOAD = "true"
.\gradlew assembleRelease

Write-Host "Copying APK back to source..."
if (Test-Path "app\build\outputs\apk\release\app-release.apk") {
    Copy-Item -Path "app\build\outputs\apk\release\app-release.apk" -Destination "$Src\android\app\build\outputs\apk\release\app-release.apk" -Force
    Write-Host "SUCCESS!"
} else {
    throw "APK not found!"
}
