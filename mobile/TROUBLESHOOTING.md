# Troubleshooting Guide - "Something Went Wrong"

## Common Causes and Solutions

### 1. Missing Assets (FIXED ✅)
**Problem**: App.json referenced missing image files
**Solution**: Removed asset references from app.json - app will use defaults

### 2. Cache Issues
**Problem**: Expo cache might be corrupted
**Solution**: Clear cache and restart

```bash
# Stop any running Expo server (Ctrl+C)
# Then run:
npx expo start --clear
```

### 3. Network Connection Issues
**Problem**: Device can't reach your computer
**Solution**: Verify network connectivity

#### Check Backend is Accessible
Open this URL in your phone's browser:
```
http://192.168.29.196:3000/api/v1/health
```

If it doesn't load:
- Make sure phone and computer are on same WiFi
- Check Windows Firewall settings
- Try using `--tunnel` mode (see below)

### 4. Firewall Blocking Connection
**Problem**: Windows Firewall blocking Expo
**Solution**: Allow Expo through firewall

1. Open Windows Defender Firewall
2. Click "Allow an app through firewall"
3. Find "Node.js" and check both Private and Public
4. Click OK

### 5. Port Already in Use
**Problem**: Port 8081 is already taken
**Solution**: Use a different port

```bash
npx expo start --port 8082
```

### 6. Use Tunnel Mode (Easiest Fix)
**Problem**: Network configuration issues
**Solution**: Use ngrok tunnel

```bash
npx expo start --tunnel
```

This creates a public URL that works from anywhere.

## Step-by-Step Troubleshooting

### Step 1: Clear Everything
```bash
# In mobile folder
npx expo start --clear
```

### Step 2: Check Expo Go App
- Make sure Expo Go is updated to latest version
- Try uninstalling and reinstalling Expo Go

### Step 3: Try Tunnel Mode
```bash
npx expo start --tunnel
```
Wait for the tunnel URL to appear, then scan the QR code.

### Step 4: Check for Errors
Look at the terminal output for specific error messages and share them.

### Step 5: Try Web Version
```bash
npx expo start --web
```
This will open in your browser to test if the app code works.

## Getting More Information

### View Detailed Logs
When you see "Something went wrong", shake your device and select "Show Dev Menu" → "Debug Remote JS"

### Check Metro Bundler
Look at the terminal where you ran `npm start` for error messages.

### Common Error Messages

#### "Unable to resolve module"
```bash
# Clear cache and reinstall
rm -rf node_modules
npm install
npx expo start --clear
```

#### "Network request failed"
- Check API URL in mobile/.env
- Verify backend is running: `docker ps`
- Test backend: `curl http://192.168.29.196:3000/api/v1/health`

#### "Invariant Violation"
- Usually a code error
- Check the error message in terminal
- Look for missing dependencies

## Quick Fixes Checklist

- [ ] Clear Expo cache: `npx expo start --clear`
- [ ] Verify IP address: `ipconfig`
- [ ] Check backend is running: `docker ps`
- [ ] Test backend URL in phone browser
- [ ] Update Expo Go app
- [ ] Try tunnel mode: `npx expo start --tunnel`
- [ ] Check Windows Firewall
- [ ] Restart computer and phone
- [ ] Try web version: `npx expo start --web`

## Still Not Working?

1. Share the exact error message from terminal
2. Share any error from Expo Go app
3. Try running on Android emulator instead:
   ```bash
   npx expo start --android
   ```

## Alternative: Use Android Emulator

If physical device continues to have issues:

1. Install Android Studio
2. Set up an Android emulator
3. Run: `npx expo start --android`

This bypasses network issues entirely.
