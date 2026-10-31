const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const AI_DIR = path.join(__dirname, '..', 'ai-engine');
const BACKEND_DIR = __dirname;

const checkEndpoint = (urlStr) => {
  return new Promise((resolve) => {
    const url = new URL(urlStr);
    const req = http.get({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      timeout: 1000
    }, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
};

const pollUntilReady = async (urlStr, maxRetries = 25, delayMs = 500) => {
  for (let i = 0; i < maxRetries; i++) {
    const isReady = await checkEndpoint(urlStr);
    if (isReady) return true;
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return false;
};

const main = async () => {
  console.log('[Runner] Booting Python AI Microservice (Port 8000)...');
  const pythonProc = spawn('python', ['-m', 'uvicorn', 'app:app', '--port', '8000'], {
    cwd: AI_DIR,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  const aiReady = await pollUntilReady('http://127.0.0.1:8000/health');
  if (!aiReady) {
    console.error('[Runner Error] Python AI engine failed to start.');
    pythonProc.kill();
    process.exit(1);
  }
  console.log('✅ Python AI Engine is online on http://127.0.0.1:8000');

  console.log('[Runner] Booting Node.js Backend Gateway (Port 5000)...');
  const nodeProc = spawn('node', ['server.js'], {
    cwd: BACKEND_DIR,
    env: { ...process.env, PORT: '5000', AI_SERVICE_URL: 'http://127.0.0.1:8000' },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  const nodeReady = await pollUntilReady('http://127.0.0.1:5000/api/health');
  if (!nodeReady) {
    console.error('[Runner Error] Node backend failed to start.');
    pythonProc.kill();
    nodeProc.kill();
    process.exit(1);
  }
  console.log('✅ Node.js Backend is online on http://127.0.0.1:5000\n');

  console.log('[Runner] Executing RCA Engine Test Suite...\n');
  const testProc = spawn('node', ['test_rca_engine.js'], {
    cwd: BACKEND_DIR,
    stdio: 'inherit'
  });

  testProc.on('close', (code) => {
    console.log(`\n[Runner] Test process finished with code ${code}. Tearing down services...`);
    pythonProc.kill();
    nodeProc.kill();
    process.exit(code);
  });
};

main();
