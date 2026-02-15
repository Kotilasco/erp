console.log('DEBUG: Hello from debug-seed.js');
try {
    const fs = require('fs');
    console.log('DEBUG: fs module loaded');
    const path = require('path');
    console.log('DEBUG: path module loaded');

    const envPath = path.resolve(__dirname, '.env');
    console.log('DEBUG: .env path determined:', envPath);

    if (fs.existsSync(envPath)) {
        console.log('DEBUG: .env file exists');
    } else {
        console.log('DEBUG: .env file NOT found');
    }

    require('dotenv').config();
    console.log('DEBUG: dotenv loaded (if present)');

} catch (e) {
    console.error('DEBUG: Error during imports:', e);
}

console.log('DEBUG: Script finished');
