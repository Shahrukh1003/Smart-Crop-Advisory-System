# Fix Network Connection Issue

## Error: "Failed to download remote update"

This means your phone can't reach your computer at `192.168.29.196:8081`.

## Solution 1: Use Tunnel Mode (Easiest) ✅

```bash
cd mobile
npx expo start --tunnel --clear
```

This creates a public URL that works from anywhere. Wait for "Tunnel ready" message, then scan the QR code.

## Solution 2: Fix Local Network

### Check 1: Same WiFi Network
- Computer and phone MUST be on the same WiFi
- Not mobile data
- Not different WiFi networks
- Check WiFi name on both devices

### Check 2: Windows Firewall

1. Open "Windows Defender Firewall"
2. Click "Allow an app through firewall"
3. Click "Change settings"
4. Find "Node.js JavaScript Runtime"
5. Check BOTH "Private" and "Public"
6. Click OK

### Check 3: Verify IP Address

```bash
ipconfig
```

Look for "IPv4 Address" under your WiFi adapter. Should be `192.168.29.196`.

If it changed, update `mobile/.env`:
```
EXPO_PUBLIC_API_URL=http://YOUR_NEW_IP:3000/api/v1
```

### Check 4: Test Connection from Phone

Open your phone's browser and go to:
```
http://192.168.29.196:8081
```

If it doesn't load:
- Firewall is blocking
- Wrong network
- IP address changed

## Solution 3: Use Localhost Mode (Android Emulator)

If you have Android Studio:

```bash
cd mobile
npx expo start --android
```

This runs on an emulator and bypasses network issues entirely.

## Recommended: Use Tunnel Mode

For development, tunnel mode is the most reliable:

```bash
npx expo start --tunnel
```

Pros:
- Works from anywhere
- No firewall issues
- No network configuration needed

Cons:
- Slightly slower initial load
- Requires internet connection

## Quick Fix Script

Run this:

```bash
cd mobile
npx expo start --tunnel --clear
```

Wait for "Tunnel ready", then scan the QR code. It will work!
