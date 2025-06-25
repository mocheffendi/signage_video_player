const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow, miniWindow;
let isAlwaysOnTop = true; // default true

let laporanWindow = null;


function createMainWindow() {
    mainWindow = new BrowserWindow({
        width: 900,
        height: 600,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });
    mainWindow.loadFile('index.html');

    // ✅ Tutup miniwindow kalau main window ditutup
    mainWindow.on('closed', () => {
        // ✅ Tutup laporan window jika masih terbuka
        if (laporanWindow && !laporanWindow.isDestroyed()) {
            laporanWindow.close();
        }
        if (miniWindow && !miniWindow.isDestroyed()) {
            miniWindow.close();
        }
        mainWindow = null;
    });
}

function createMiniWindow() {
    const bounds = loadWindowBounds();
    miniWindow = new BrowserWindow({
        width: bounds.width,
        height: bounds.height,
        x: bounds.x,
        y: bounds.y,
        frame: false,
        alwaysOnTop: true,
        resizable: true,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    miniWindow.loadFile('miniwindow.html');
}

app.whenReady().then(() => {
    createMainWindow();
    createMiniWindow();
    // 🔥 Kirim posisi & ukuran ke main window
    const bounds = loadWindowBounds();
    mainWindow.webContents.once('did-finish-load', () => {
        mainWindow.webContents.send('init-bounds', bounds);
    });
});

ipcMain.handle('open-file-dialog', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
        properties: ['openFile', 'multiSelections'],
        filters: [{ name: 'Media', extensions: ['mp4', 'jpg', 'jpeg', 'png'] }]
    });
    return canceled ? null : filePaths;
});

ipcMain.on('media-selected', (event, data) => {
    if (!miniWindow) return;
    miniWindow.webContents.send('play-media', data);
});

// ipcMain.on('set-window-bounds', (event, bounds) => {
//     if (miniWindow) {
//         miniWindow.setBounds(bounds);
//     }
// });

ipcMain.on('set-window-bounds', (event, bounds) => {
    if (miniWindow) {
        miniWindow.setBounds(bounds);
        saveWindowBounds(bounds); // 💾 simpan otomatis
    }
});

// const fs = require('fs');
const configPath = path.join(__dirname, 'config.json');

function saveWindowBounds(bounds) {
    fs.writeFileSync(configPath, JSON.stringify(bounds, null, 2));
}

function loadWindowBounds() {
    const defaultBounds = { width: 300, height: 200, x: 0, y: 0 };

    if (!fs.existsSync(configPath)) {
        // 📝 Buat file baru jika belum ada
        fs.writeFileSync(configPath, JSON.stringify(defaultBounds, null, 2));
        return defaultBounds;
    }

    try {
        return JSON.parse(fs.readFileSync(configPath));
    } catch (err) {
        console.warn("Gagal baca config.json:", err);
        return defaultBounds;
    }
}

ipcMain.handle('toggle-always-on-top', () => {
    if (!miniWindow || !mainWindow) return false;

    isAlwaysOnTop = !isAlwaysOnTop;
    miniWindow.setAlwaysOnTop(isAlwaysOnTop);

    // 🔥 Bring main window to front
    mainWindow.show();
    mainWindow.focus();

    return isAlwaysOnTop;
});

ipcMain.on('open-log-window', () => {
    if (laporanWindow && !laporanWindow.isDestroyed()) {
        laporanWindow.focus();
        return;
    }

    laporanWindow = new BrowserWindow({
        width: 800,
        height: 600,
        title: "Laporan Playback",
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    laporanWindow.loadFile('laporan.html');

    laporanWindow.on('closed', () => {
        laporanWindow = null;
    });
});

ipcMain.handle('show-save-dialog', async () => {
    const result = await dialog.showSaveDialog({
        title: 'Simpan Laporan',
        defaultPath: 'laporan.csv',
        filters: [{ name: 'CSV File', extensions: ['csv'] }]
    });

    if (result.canceled) return null;
    return result.filePath;
});

ipcMain.handle('show-save-dialog-xlsx', async () => {
    const result = await dialog.showSaveDialog({
        title: 'Simpan Laporan',
        defaultPath: 'laporan.xlsx',
        filters: [{ name: 'Excel File', extensions: ['xlsx'] }]
    });

    if (result.canceled) return null;
    return result.filePath;
});