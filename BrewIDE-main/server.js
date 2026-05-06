/**
 * BrewIDE — Production Java Execution & Web Server
 * -----------------------------------------------
 * Handles both the IDE frontend and the Java backend.
 */

const http  = require('http');
const fs    = require('fs');
const path  = require('path');
const os    = require('os');
const { execFile, spawnSync } = require('child_process');

const PORT    = process.env.PORT || 5454; // Use Render's port or default to 5454
const TIMEOUT = 15000; 

// MIME types to help the browser understand CSS/JS files
const MIME_TYPES = {
  '.html': 'text/html',
  '.js':   'text/javascript',
  '.css':  'text/css',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpg',
};

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function getJavaVersion() {
  const r = spawnSync('java', ['-version'], { encoding: 'utf8' });
  const out = (r.stderr || r.stdout || '').split('\n')[0];
  return out || 'unknown';
}

function getJavacPath() {
  const r = spawnSync(process.platform === 'win32' ? 'where' : 'which', ['javac'], { encoding: 'utf8' });
  return (r.stdout || '').trim();
}

function runJava(source, stdin, callback) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'brewide-'));
  const srcFile = path.join(tmpDir, 'Main.java');
  fs.writeFileSync(srcFile, source, 'utf8');

  execFile('javac', ['-encoding', 'UTF-8', srcFile], { timeout: TIMEOUT, cwd: tmpDir }, (compileErr, compileStdout, compileStderr) => {
    if (compileErr) {
      cleanup(tmpDir);
      const cleanErr = (compileStderr || compileErr.message || '').replace(new RegExp(tmpDir.replace(/\\/g, '\\\\'), 'g'), '');
      return callback({ compileError: cleanErr.trim(), stdout: '', stderr: '', exitCode: 1 });
    }

    const child = require('child_process').spawn('java', ['-cp', tmpDir, 'Main'], { timeout: TIMEOUT, cwd: tmpDir });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', d => { stdout += d; });
    child.stderr.on('data', d => { stderr += d; });
    if (stdin) { child.stdin.write(stdin); }
    child.stdin.end();

    child.on('close', (code, signal) => {
      cleanup(tmpDir);
      callback({ compileError: '', stdout: stdout.trimEnd(), stderr: stderr.trimEnd(), exitCode: code ?? 0, signal: signal || null });
    });
  });
}

function cleanup(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {}
}

const server = http.createServer((req, res) => {
  cors(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // 1. JAVA EXECUTION ENDPOINT
  if (req.method === 'POST' && req.url === '/execute') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      let parsed;
      try { parsed = JSON.parse(body); } catch (_) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
        return;
      }
      runJava(parsed.source, parsed.stdin || '', (result) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      });
    });
    return;
  }

  // 2. HEALTH CHECK
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, java: getJavaVersion() }));
    return;
  }

  // 3. STATIC FILE SERVER (Serves your index.html, CSS, and JS)
  let filePath = req.url === '/' ? './index.html' : '.' + req.url;
  const extname = String(path.extname(filePath)).toLowerCase();
  const contentType = MIME_TYPES[extname] || 'application/octet-stream';

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        res.writeHead(404);
        res.end('File not found');
      } else {
        res.writeHead(500);
        res.end('Server error: ' + error.code);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  ✓ BrewIDE live at http://0.0.0.0:${PORT}\n`);
});