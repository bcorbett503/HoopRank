# Start Mobile App Script

# 1. Stop Gradle Daemons to ensure fresh environment
Write-Host "Stopping Gradle Daemons..."
.\android\gradlew.bat --stop 2>$null

# 2. Clean Build Cache (More robust than manual deletion)
Write-Host "Cleaning Flutter build cache..."
flutter clean

# 3. Get Dependencies
Write-Host "Fetching dependencies..."
flutter pub get

# 4. Check for connected devices
Write-Host "Checking for connected devices..."
$devices = flutter devices
Write-Host $devices

# 5. Run the App
# Default to emulator-5554 if available, otherwise let Flutter choose
if ($devices -match "emulator-5554") {
    Write-Host "Launching on emulator-5554..."
    flutter run -d emulator-5554
} else {
    Write-Host "Launching on default device..."
    flutter run
}
