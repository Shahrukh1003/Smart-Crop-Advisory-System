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

    console.log('✅ Backend found! Starting localtunnel...');

    // Use npx localtunnel to expose the port
    const lt = spawn('npx', ['-y', 'localtunnel', '--port', PORT.toString()], {
        shell: true
    });

    lt.stdout.on('data', (data) => {
        const output = data.toString();
        console.log(output);

        // Extract the URL (e.g., "your url is: https://something.loca.lt")
        if (output.includes('your url is:')) {
            const urlMatch = output.match(/https?:\/\/[^\s]+/);
            if (urlMatch) {
                let publicUrl = urlMatch[0];
                console.log(`\n🎉 Public URL obtained: ${publicUrl}`);

                // Append /api/v1
                const apiUrl = `${publicUrl}/api/v1`;

                // Write to mobile/.env
                const envContent = `EXPO_PUBLIC_API_URL=${apiUrl}\n`;
                fs.writeFileSync(ENV_PATH, envContent);

                console.log(`\n💾 Successfully updated mobile/.env with:`);
                console.log(`   EXPO_PUBLIC_API_URL=${apiUrl}\n`);

                console.log('======================================================');
                console.log('📱 READY FOR CROSS-NETWORK TESTING!');
                console.log('👉 To run the app on your phone via ANY network (like Cellular):');
                console.log('   1. Open a new terminal');
                console.log('   2. cd mobile');
                console.log('   3. npx expo start --tunnel');
                console.log('   4. Scan the QR code with Expo Go');
                console.log('======================================================');
                console.log('\n(Leave this terminal running to keep the tunnel open...)\n');
            }
        }
    });

    lt.stderr.on('data', (data) => {
        console.error(`Tunnel Error: ${data}`);
    });

    lt.on('close', (code) => {
        console.log(`Tunnel process exited with code ${code}`);
    });
};

startTunnel();
