# Debug Steps - "Something Went Wrong"

## Step 1: Check Terminal Output

Look at your terminal where you ran `npm start`. Share the **exact error message** you see there.

Common errors and solutions:

### Error: "Unable to resolve module"
```bash
# Clear cache and reinstall
rm -rf node_modules
npm install
npx expo start --clear
```

### Error: "Network request failed"
The app can't reach the backend. Check:
1. Backend is running: `docker ps`
2. IP address is correct in `mobile/.env`
3. Test backend: Open `http://192.168.29.196:3000/api/v1/health` in your phone's browser

### Error: "Invariant Violation" or "Element type is invalid"
Code error. Check the stack trace in terminal.

## Step 2: View Error Log in Expo Go

1. Shake your device
2. Select "Show Dev Menu"
3. Tap "Debug Remote JS"
4. Open Chrome DevTools (http://localhost:19000/debugger-ui)
5. Check Console tab for errors

## Step 3: Check What's Actually Running

```bash
# In terminal where you ran npm start
# Look for these lines:
Metro waiting on exp://192.168.x.x:8081
› Scan the QR code above with Expo Go (Android) or the Camera app (iOS)
```

If you see errors instead, share them.

## Step 4: Try These Fixes

### Fix 1: Clear Everything
```bash
# Stop Expo (Ctrl+C)
cd mobile

# Delete caches
rm -rf .expo
rm -rf node_modules/.cache
rm -rf $TMPDIR/react-*
rm -rf $TMPDIR/metro-*

# Restart
npx expo start --clear
```

### Fix 2: Use Tunnel Mode
```bash
npx expo start --tunnel
```
This bypasses network issues.

### Fix 3: Check Environment Variables
```bash
# In mobile folder
cat .env
```
Should show:
```
EXPO_PUBLIC_API_URL=http://192.168.29.196:3000/api/v1
```

### Fix 4: Verify Backend
```bash
# Check backend is running
docker ps | grep smart-crop-backend

# Test backend
curl http://192.168.29.196:3000/api/v1/health
```

Should return:
```json
{"status":"healthy","timestamp":"...","service":"smart-crop-advisory-backend"}
```

### Fix 5: Update Expo Go
1. Go to Play Store/App Store
2. Search "Expo Go"
3. Update to latest version
4. Try again

## Step 5: Get Detailed Error Info

### Enable Verbose Logging
```bash
npx expo start --clear --verbose
```

### Check Metro Bundler
Look for errors in the Metro bundler output (the terminal).

### Common Issues:

#### "Cannot find module 'expo-constants'"
```bash
npm install expo-constants
```

#### "SecureStore is not available"
This is normal on first load. The app should handle it gracefully.

#### "Network Error" or "ECONNREFUSED"
Backend not reachable:
1. Check firewall
2. Verify IP address
3. Use tunnel mode

## Step 6: Test Individual Components

### Test Backend Connection
Create a simple test file:

```bash
# In mobile folder
curl http://192.168.29.196:3000/api/v1/health
```

### Test on Web (Bypass Device Issues)
```bash
npx expo start --web
```

If it works on web but not device, it's a network issue.

## Step 7: Share Error Details

If still not working, share:

1. **Terminal output** (full error message)
2. **Expo Go error** (screenshot or text)
3. **Metro bundler logs** (any red errors)
4. **Backend status**: `docker ps`
5. **Network test**: Can you open `http://192.168.29.196:3000/api/v1/health` in your phone's browser?

## Quick Checklist

- [ ] Backend running: `docker ps`
- [ ] Expo started with: `npx expo start --clear`
- [ ] Phone on same WiFi as computer
- [ ] Expo Go updated to latest version
- [ ] `.env` file exists in mobile folder
- [ ] No red errors in terminal
- [ ] Tried tunnel mode: `npx expo start --tunnel`

## Emergency: Start Fresh

If nothing works:

```bash
# Stop everything
docker-compose down
# Ctrl+C to stop Expo

# Clean mobile
cd mobile
rm -rf node_modules
rm -rf .expo
npm install

# Restart backend
cd ..
docker-compose up -d

# Wait 10 seconds for backend to start
# Then start mobile
cd mobile
npx expo start --tunnel
```

Use `--tunnel` mode to bypass all network issues.
