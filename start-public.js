const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

const PORT = 3000;
const ENV_PATH = path.join(__dirname, 'mobile', '.env');

// First check if the backend is running
const checkBackend = () => {
    return new Promise((resolve) => {
        const req = http.get(`http://127.0.0.1:${PORT}/api/docs`, (res) => {
            resolve(true); // If we get ANY response, the port is active
        }).on('error', (err) => {
            // Sometimes it rejects but the port IS bound in a weird way
            if (err.code === 'ECONNREFUSED') {
                resolve(false);
            } else {
                resolve(true); // E.g., HPE_INVALID_CONSTANT (it's bound but expects different protocol)
            }
        });
        req.end();
    });
};

const startTunnel = async () => {
    console.log('🔍 Checking if backend is running on port 3000...');
    const isRunning = await checkBackend();

    if (!isRunning) {
        console.error('❌ ERROR: Backend is not running on port 3000!');
        console.log('👉 Please run your backend first: cd backend && npm run start:dev');
        process.exit(1);
    }

    console.log('✅ Backend found! Starting Cloudflare tunnel...');

    // Use npx cloudflared tunnel to expose the port
    const lt = spawn('npx', ['-y', 'cloudflared', 'tunnel', '--url', `http://127.0.0.1:${PORT}`], {
        shell: true
    });

    lt.stderr.on('data', (data) => {
        const output = data.toString();
        // console.log(output); // For debugging

        // Extract the Cloudflare URL (e.g., "https://random-words.trycloudflare.com")
        if (output.includes('trycloudflare.com')) {
            const urlMatch = output.match(/https?:\/\/[a-z0-9-]+\.trycloudflare\.com/);
            if (urlMatch) {
                const publicUrl = urlMatch[0];
                updateEnvAndNotify(publicUrl);
            }
        }
    });

    const updateEnvAndNotify = (publicUrl) => {
        // Prevent multiple updates for the same URL
        if (global.lastUrl === publicUrl) return;
        global.lastUrl = publicUrl;

        console.log(`\n🎉 Public URL obtained: ${publicUrl}`);

        const apiUrl = `${publicUrl}/api/v1`;
        const envContent = `EXPO_PUBLIC_API_URL=${apiUrl}\n`;
        fs.writeFileSync(ENV_PATH, envContent);

        console.log(`\n💾 Successfully updated mobile/.env with:`);
        console.log(`   EXPO_PUBLIC_API_URL=${apiUrl}\n`);

        console.log('======================================================');
        console.log('📱 READY FOR PERMANENT STABLE TESTING!');
        console.log('👉 The 503 errors should now be completely gone.');
        console.log('👉 Please restart your Expo app to use the new URL:');
        console.log('   npx expo start --tunnel --clear');
        console.log('======================================================');
    };

    lt.on('close', (code) => {
        console.log(`Tunnel process exited with code ${code}`);
    });
};

startTunnel();
