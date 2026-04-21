/**
 * BrewIDE — Local Java Execution Server
 * --------------------------------------
 * Runs on http://localhost:5454
 * Receives Java source code, compiles + runs it with your local JDK.
 *
 * Usage:
 *   node server.js
 *
 * Requirements:
 *   - Node.js (any recent version)
 *   - Java (JDK) installed and on PATH (java + javac)
 */

const http  = require('http');
const fs    = require('fs');
const path  = require('path');
const os    = require('os');
const { execFile, spawnSync } = require('child_process');

const PORT    = 5454;
const TIMEOUT = 15000; // 15 seconds max execution time

// ── CORS headers — allow BrewIDE (any local file or localhost) ───────────────
function cors(res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// ── Check Java is available ──────────────────────────────────────────────────
function getJavaVersion() {
  const r = spawnSync('java', ['-version'], { encoding: 'utf8' });
  const out = (r.stderr || r.stdout || '').split('\n')[0];
  return out || 'unknown';
}

function getJavacPath() {
  const r = spawnSync(process.platform === 'win32' ? 'where' : 'which',
    ['javac'], { encoding: 'utf8' });
  return (r.stdout || '').trim();
}

// ── Run Java source code ─────────────────────────────────────────────────────
function runJava(source, stdin, callback) {
  // Write source to a temp directory
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'brewide-'));
  const srcFile = path.join(tmpDir, 'Main.java');

  fs.writeFileSync(srcFile, source, 'utf8');

  // Step 1: javac
  execFile('javac', ['-encoding', 'UTF-8', srcFile], {
    timeout: TIMEOUT,
    cwd: tmpDir,
  }, (compileErr, compileStdout, compileStderr) => {

    if (compileErr) {
      cleanup(tmpDir);
      // Strip temp path from error messages so they show "Main.java:5" not "/tmp/brewide-xxx/Main.java:5"
      const cleanErr = (compileStderr || compileErr.message || '')
        .replace(new RegExp(tmpDir.replace(/\\/g, '\\\\'), 'g'), '');
      return callback({ compileError: cleanErr.trim(), stdout: '', stderr: '', exitCode: 1 });
    }

    // Step 2: java Main
    const child = require('child_process').spawn('java', ['-cp', tmpDir, 'Main'], {
      timeout: TIMEOUT,
      cwd: tmpDir,
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', d => { stdout += d; });
    child.stderr.on('data', d => { stderr += d; });

    // Feed stdin if provided
    if (stdin) {
      child.stdin.write(stdin);
    }
    child.stdin.end();

    child.on('close', (code, signal) => {
      cleanup(tmpDir);
      callback({
        compileError: '',
        stdout: stdout.trimEnd(),
        stderr: stderr.trimEnd(),
        exitCode: code ?? 0,
        signal: signal || null,
      });
    });

    child.on('error', (err) => {
      cleanup(tmpDir);
      callback({ compileError: '', stdout: '', stderr: err.message, exitCode: 1, signal: null });
    });
  });
}

function cleanup(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {}
}

// ── HTTP Server ──────────────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  cors(res);

  // Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Health check
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, java: getJavaVersion(), javac: getJavacPath() }));
    return;
  }

  // Execute endpoint
  if (req.method === 'POST' && req.url === '/execute') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      let parsed;
      try { parsed = JSON.parse(body); }
      catch (_) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
        return;
      }

      const { source, stdin } = parsed;
      if (!source) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing source' }));
        return;
      }

      runJava(source, stdin || '', (result) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      });
    });
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, '127.0.0.1', () => {
  const jv = getJavaVersion();
  console.log('');
  console.log('  ╔══════════════════════════════════════════╗');
  console.log('  ║        BrewIDE — Java Server             ║');
  console.log('  ╚══════════════════════════════════════════╝');
  console.log('');
  console.log(`  ✓ Listening on  http://localhost:${PORT}`);
  console.log(`  ✓ Java version  ${jv}`);
  console.log(`  ✓ javac path    ${getJavacPath() || '(not found — is JDK installed?)'}`);
  console.log('');
  console.log('  Keep this window open while using BrewIDE.');
  console.log('  Press Ctrl+C to stop.');
  console.log('');
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n  ✗ Port ${PORT} is already in use.`);
    console.error('  Close the other process or change PORT in server.js\n');
  } else {
    console.error('\n  ✗ Server error:', err.message, '\n');
  }
  process.exit(1);
});