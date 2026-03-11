const { spawn } = require('child_process');
const lt = spawn('npx', ['-y', 'ngrok', 'http', '3000'], { shell: true });
lt.stdout.on('data', d => console.log('STDOUT:', d.toString()));
lt.stderr.on('data', d => console.log('STDERR:', d.toString()));
lt.on('close', c => console.log('EXIT:', c));
setTimeout(() => process.exit(), 10000);
