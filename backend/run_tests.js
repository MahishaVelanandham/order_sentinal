const { spawn } = require('child_process');
const path = require('path');

const serverProcess = spawn('node', ['server.js'], {
  cwd: __dirname,
  env: { ...process.env, PORT: '5000' },
  stdio: ['ignore', 'pipe', 'pipe']
});

let serverStarted = false;

serverProcess.stdout.on('data', (data) => {
  const msg = data.toString();
  // process.stdout.write('[Server] ' + msg);
  if (msg.includes('Server listening on') && !serverStarted) {
    serverStarted = true;
    console.log('[Runner] Server detected online. Launching test suite...\n');
    setTimeout(executeTests, 800);
  }
});

serverProcess.stderr.on('data', (data) => {
  // console.error('[Server Err] ' + data.toString());
});

const executeTests = () => {
  const testProcess = spawn('node', ['test_order_engine.js'], {
    cwd: __dirname,
    stdio: 'inherit'
  });

  testProcess.on('close', (code) => {
    console.log(`\n[Runner] Test suite finished with exit code ${code}. Shutting down server...`);
    serverProcess.kill();
    process.exit(code);
  });
};

setTimeout(() => {
  if (!serverStarted) {
    console.error('[Runner Timeout] Server did not start within 8 seconds.');
    serverProcess.kill();
    process.exit(1);
  }
}, 8000);
