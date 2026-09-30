# BLE Grade

Expo / React Native app for the Bluetooth LE assignment. It connects to the teacher's device and works with one characteristic:

| | UUID |
|---|---|
| Service | `aee04821-1973-4e1f-a590-e84b10d580e7` |
| Characteristic | `cde07b1a-889b-44b7-a99f-c888dddac729` |

The screen is in [src/app/index.tsx](src/app/index.tsx). The Bluetooth code is in [src/ble/](src/ble/): `transport.ts` for Android and iOS (react-native-ble-plx), and `transport.web.ts` for browsers (Web Bluetooth).

## In class

1. Turn on Bluetooth, open **BLE Grade**, and allow the "Nearby devices" permission.
2. Tap **Scan devices**, then tap the teacher's device (e.g. "Mobile App 169"). A device that advertises the class service is highlighted.
3. **Step 1:** tap **Read value**. The device answers something like "Enter your name". 📸
4. **Step 2:** type your name and your buddy's name, then tap **Write value**. The app writes `Your Name & Buddy Name`. 📸 the "Write success" alert.
5. **Step 3:** tap **Read value again** to see the predicted grade. 📸
6. The **Activity log** at the bottom records every read and write with a timestamp, so one screenshot of it covers all three steps.
7. Tap **View result summary** to open one screen with the names, device, all three steps and the grade. 📸 It's made for a single submission screenshot.

## Install on an Android phone

The APK is `BLE-Grade.apk` in the project folder, copied from `android/app/build/outputs/apk/release/app-release.apk`. You can install it in either of these ways:

- Copy it to the phone and open it. You have to allow "Install unknown apps".
- Use USB debugging: `~/Library/Android/sdk/platform-tools/adb install -r android/app/build/outputs/apk/release/app-release.apk`

This is a standalone release build, so you don't need a dev server or a Wi-Fi connection. It won't run in Expo Go because BLE needs native code.

### Rebuild after changing code

```bash
npx expo prebuild --platform android      # only after app.json / plugin changes
cd android
JAVA_HOME=~/Library/Java/JavaVirtualMachines/jdk-21.0.12.1+1/Contents/Home \
ANDROID_HOME=~/Library/Android/sdk \
JAVA_TOOL_OPTIONS="-Duser.language=en -Duser.country=US" \
./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a,armeabi-v7a
```

- Use JDK 21, because Gradle doesn't work with the default JDK 25.
- Keep `JAVA_TOOL_OPTIONS`. On a Mac with a Thai region, Java uses the Buddhist calendar (year 2569), and the APK zip step then fails with `VerifyException ... MsDosDateTimeUtils.packDate`.

For live reload while you develop, run `npx expo run:android` with the phone connected by USB.

### iPhone

Run `npx expo run:ios --device` with the iPhone connected. Xcode needs a signing team, and a free Apple ID works. You can also build in the cloud with `eas build -p ios --profile development`.

## Run in a web browser

```bash
npx expo start --web     # opens http://localhost:8081
# http://localhost:8081/?demo  → try the screens with a simulated device (no Bluetooth)
```

- The web version works in **Chrome or Edge** on Mac, Windows or Android. On a Mac, allow Chrome under System Settings → Privacy & Security → Bluetooth.
- **iPhone browsers don't support Web Bluetooth**, and that includes Safari and Chrome for iOS. The only way on an iPhone is the **Bluefy** browser app, and the page must be served over HTTPS.
- Browsers can't list nearby devices, so click **Choose device** and pick the device in the browser's popup.
- A Mac can't connect to itself. The mock device below won't show up in Chrome on the same Mac, so test the web version against the real device or another peripheral.
- Expo Go has no BLE module. There the app switches to a **simulated device** with a red DEMO banner, so you can click through the screens. Don't submit those screenshots.

## Test before class with the mock device

[tools/mock-device/mock_device.py](tools/mock-device/mock_device.py) makes your Mac act like the teacher's device. It uses the same UUIDs, answers "Enter your name" at first, and after a write answers "<name> - Your grade is X.".

```bash
cd tools/mock-device
python3 -m venv .venv && .venv/bin/pip install bless   # first time only
.venv/bin/python mock_device.py
```

The first time you run it, macOS asks for Bluetooth permission for Terminal or VS Code. In the app, look for **Mock Grade Device**. Some phones show the Mac's name instead, and the device with the "Has the class service" badge is the right one.

## Icons

The app icon and splash image are drawn by [tools/make_icons.py](tools/make_icons.py). After changing it, run `python3 tools/make_icons.py` and then `npx expo prebuild`.
