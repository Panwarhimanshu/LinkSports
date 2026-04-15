@echo off
set ANDROID_HOME=C:\Users\himan\AppData\Local\Android\Sdk
set PATH=%PATH%;%ANDROID_HOME%\platform-tools;%ANDROID_HOME%\tools
cd /d "C:\Users\himan\OneDrive\Desktop\LinkSports\Linksports App\mobile\LinksportsApp\android"
echo Building and installing debug APK...
call gradlew.bat app:installDebug -PreactNativeDevServerPort=8081
if %ERRORLEVEL% EQU 0 (
    echo.
    echo APK installed successfully! Starting app...
    adb shell am start -n com.linksportsapp/.MainActivity
) else (
    echo.
    echo Build FAILED with error code %ERRORLEVEL%
)
