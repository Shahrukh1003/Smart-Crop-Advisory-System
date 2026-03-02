# Assets Folder

This folder contains the app's visual assets.

## Required Files

The following files are referenced in app.json but need to be created:

1. **icon.png** (1024x1024) - App icon
2. **splash.png** (1284x2778) - Splash screen
3. **adaptive-icon.png** (1024x1024) - Android adaptive icon
4. **favicon.png** (48x48) - Web favicon
5. **notification-icon.png** (96x96) - Notification icon

## Temporary Solution

For development, you can use placeholder images or disable these in app.json.

## Creating Assets

You can create these assets using:
- Design tools (Figma, Photoshop, etc.)
- Online generators (e.g., https://www.appicon.co/)
- Or use the default Expo assets temporarily

## Quick Fix

Run this command to generate default assets:
```bash
npx expo prebuild --clean
```

Or update app.json to remove asset references temporarily.
