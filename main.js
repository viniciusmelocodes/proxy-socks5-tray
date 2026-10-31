const { app, Tray, Menu, BrowserWindow, dialog } = require('electron');
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

  mainWindow.loadURL(`data:text/html;charset=utf-8,
    <html>
      <body style="background:#1e1e1e;color:#0f0;font-family:Consolas,monospace;padding:10px;overflow:auto">
        <pre id="log"></pre>
      </body>
      <script>
        const { ipcRenderer } = require('electron');
        ipcRenderer.on('log', (_, msg) => {
          const el = document.getElementById('log');
          el.textContent += msg + '\\n';
          el.scrollTop = el.scrollHeight;
        });
      </script>
    </html>
  `);
}

function sendLog(msg) {
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
