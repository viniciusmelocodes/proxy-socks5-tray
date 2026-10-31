const { app, Tray, Menu, BrowserWindow, dialog } = require('electron');
const fs = require('fs');
const path = require('path');
const ProxyServer = require('./proxy-server');

// Impede múltiplas instâncias
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

let tray = null;
let proxy = null;
let isRunning = false;
let mainWindow = null; // janela de logs (opcional)
let isQuitting = false;
const logHistory = [];
let currentLogDate = null;
let currentLogPath = null;

function getLocalDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function writeDailyLog(message) {
  const date = getLocalDate();

  if (date !== currentLogDate) {
    const logDirectory = path.join(app.getPath('userData'), 'logs');
    fs.mkdirSync(logDirectory, { recursive: true });
    currentLogDate = date;
    currentLogPath = path.join(logDirectory, `proxy-${date}.txt`);
  }

  fs.appendFileSync(currentLogPath, `${message}\n`, 'utf8');
}

// Cria a janela de logs (invisível por padrão)
function createLogWindow() {
  mainWindow = new BrowserWindow({
    width: 600,
    height: 400,
    show: false,
    webPreferences: { nodeIntegration: true, contextIsolation: false },
    title: 'Proxy SOCKS5 - Logs'
  });

  const logWindow = mainWindow;
  logWindow.on('close', (event) => {
    if (!isQuitting && !logWindow.isDestroyed()) {
      event.preventDefault();
      logWindow.hide();
    }
  });

  logWindow.on('closed', () => {
    if (mainWindow === logWindow) {
      mainWindow = null;
    }
  });

  logWindow.webContents.on('did-finish-load', () => {
    if (!logWindow.isDestroyed()) {
      logWindow.webContents.send('logs', logHistory);
    }
  });

  const logHtml = `
    <html>
      <body style="background:#1e1e1e;color:#0f0;font-family:Consolas,monospace;padding:10px;overflow:auto">
        <pre id="log"></pre>
      </body>
      <script>
        const { ipcRenderer } = require('electron');
        const logElement = document.getElementById('log');

        ipcRenderer.on('log', (_, msg) => {
          logElement.textContent += msg + '\\n';
          logElement.scrollTop = logElement.scrollHeight;
        });

        ipcRenderer.on('logs', (_, messages) => {
          logElement.textContent = messages.join('\\n') + (messages.length ? '\\n' : '');
          logElement.scrollTop = logElement.scrollHeight;
        });
      </script>
    </html>
  `;

  logWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(logHtml)}`);
}

function sendLog(msg) {
  logHistory.push(msg);
  if (logHistory.length > 200) {
    logHistory.shift();
  }

  try {
    writeDailyLog(msg);
  } catch (err) {
    console.error(`Falha ao gravar arquivo de log: ${err.message}`);
  }

  // ✅ Verifica se a janela e os webContents ainda existem
  if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents && !mainWindow.webContents.isDestroyed()) {
    mainWindow.webContents.send('log', msg);
  }
}

function updateTrayMenu() {
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Proxy SOCKS5',
      enabled: false
    },
    { type: 'separator' },
    {
      label: isRunning ? '⏹  Parar Proxy' : '▶  Iniciar Proxy',
      click: async () => {
        if (isRunning) {
          await proxy.stop();
          isRunning = false;
        } else {
          try {
            proxy = new ProxyServer(1080, '0.0.0.0');
            proxy.onLog = sendLog; // ✅ usa a função segura
            await proxy.start();
            isRunning = true;
          } catch (err) {
            dialog.showErrorBox('Erro', `Falha ao iniciar: ${err.message}`);
          }
        }
        updateTrayMenu();
      }
    },
    {
      label: '📋 Mostrar Logs',
      click: () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.show();
          mainWindow.focus();
        } else {
          createLogWindow(); // recria se foi destruída
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Sair',
      click: async () => {
        if (proxy && isRunning) await proxy.stop();
        app.quit();
      }
    }
  ]);
  tray.setContextMenu(contextMenu);
  tray.setToolTip(isRunning ? 'Proxy SOCKS5: ATIVO (:1080)' : 'Proxy SOCKS5: parado');
}

app.whenReady().then(() => {
  createLogWindow();

  const iconPath = path.join(__dirname, 'assets', 'icon.png');
  tray = new Tray(iconPath);

  updateTrayMenu();

  // Inicia automaticamente
  (async () => {
    proxy = new ProxyServer(1080, '0.0.0.0');
    proxy.onLog = sendLog; // ✅ usa a função segura
    try {
      await proxy.start();
      isRunning = true;
      updateTrayMenu();
    } catch (err) {
      dialog.showErrorBox('Erro ao iniciar', err.message);
    }
  })();
});

app.on('before-quit', async () => {
  isQuitting = true;
  if (proxy && isRunning) await proxy.stop();
});
