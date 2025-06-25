const { ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');

const videoPlayer = document.getElementById('videoPlayer');
const imageViewer = document.getElementById('imageViewer');
const files = [];

const playlistBox = document.getElementById('playlistBox');

let imageTimeout;
let currentIndex = 0;

let selectedIndex = -1;

const btnNaik = document.getElementById('btnNaik');
const btnTurun = document.getElementById('btnTurun');

const videoSlider = document.getElementById('videoSlider');
const videoTimeLabel = document.getElementById('videoTimeLabel');

let imageDuration = 15000; // default 15 detik
let imageStartTime = 0;
let imageProgressTimer;

const logPath = path.join(__dirname, 'log_playback.csv');
let playCount = 0;
let currentStartTime = null;

const btnHapusItem = document.getElementById('btnHapusItem');

function guessMimeType(fp) {
    const ext = path.extname(fp).toLowerCase();
    if (ext === '.mp4') return 'video/mp4';
    if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
    if (ext === '.png') return 'image/png';
    return 'application/octet-stream';
}

function savePlaylist() {
    const json = files.map(f => ({ name: f.name, path: f.path, type: f.type }));
    fs.writeFileSync(path.join(__dirname, 'playlist.json'), JSON.stringify(json, null, 2));
}

function renderPlaylist() {
    playlistBox.innerHTML = ''; // clear

    files.forEach((file, index) => {
        const li = document.createElement('li');
        li.textContent = file.name;
        li.dataset.index = index;

        li.style.padding = '4px';
        li.style.cursor = 'pointer';
        li.style.background = index === selectedIndex ? '#cce5ff' : 'transparent';

        li.addEventListener('click', () => {
            selectedIndex = index;
            renderPlaylist();
        });

        playlistBox.appendChild(li);
        console.log(`Added file: ${file.name} at index ${index}`);
    });
}

// function renderPlaylist() {
//     playlistBox.innerHTML = '';

//     files.forEach((file, index) => {
//         const li = document.createElement('li');
//         li.dataset.index = index;
//         li.style.padding = '4px';
//         li.style.cursor = 'pointer';
//         li.style.display = 'flex';
//         li.style.justifyContent = 'space-between';
//         li.style.background = index === selectedIndex ? '#cce5ff' : 'transparent';

//         // 📝 Nama file
//         const span = document.createElement('span');
//         span.textContent = file.name;
//         span.addEventListener('click', () => {
//             selectedIndex = index;
//             renderPlaylist();
//             playItem(index);
//         });

//         // ❌ Tombol hapus
//         const btn = document.createElement('button');
//         btn.textContent = '❌';
//         btn.style.marginLeft = '10px';
//         btn.addEventListener('click', (e) => {
//             e.stopPropagation(); // biar tidak ikut select
//             files.splice(index, 1);
//             if (selectedIndex >= files.length) selectedIndex = files.length - 1;
//             savePlaylist();
//             renderPlaylist();
//         });

//         li.appendChild(span);
//         li.appendChild(btn);
//         playlistBox.appendChild(li);
//     });
// }


function loadPlaylist() {
    const pathFile = path.join(__dirname, 'playlist.json');
    if (!fs.existsSync(pathFile)) return;

    const data = JSON.parse(fs.readFileSync(pathFile));
    files.length = 0;
    data.forEach(f => files.push(f));

    selectedIndex = 0;
    // renderPlaylist();
    // playItem(0);
    if (files.length > 0) {
        selectedIndex = 0;
        renderPlaylist();
        playItem(0);
    }
}

function swapItems(i, j) {
    if (i < 0 || j < 0 || i >= files.length || j >= files.length) return;
    [files[i], files[j]] = [files[j], files[i]];
    selectedIndex = j;
    renderPlaylist();
    savePlaylist();
    playItem(j);
}

document.getElementById('chooseFileBtn').addEventListener('click', async () => {
    const paths = await ipcRenderer.invoke('open-file-dialog');
    if (!paths) return;
    paths.forEach(fp => {
        const nm = path.basename(fp);
        const tp = guessMimeType(fp);
        const f = { name: nm, path: fp, type: tp };
        files.push(f);
        const li = document.createElement('li');
        li.textContent = nm;
        li.dataset.index = files.length - 1;
        playlistBox.appendChild(li);
    });
    selectedIndex = files.length - 1; // pilih item terakhir
    renderPlaylist();
    savePlaylist();

    playItem(selectedIndex);
    console.log("Files after adding:", files);
});

playlistBox.addEventListener('click', (e) => {
    if (e.target.tagName !== 'LI') return;

    // if (e.target.tagName !== 'LI') return;
    const idx = parseInt(e.target.dataset.index);
    playItem(idx);

    const file = files[e.target.dataset.index];
    currentFile = file;
    const fileUrl = `file://${file.path}`;

    // Reset kedua tampilan
    videoPlayer.pause();
    videoPlayer.removeAttribute('src');
    imageViewer.src = '';
    clearTimeout(imageTimeout);

    if (file.type.startsWith('video')) {
        videoPlayer.src = fileUrl;
        videoPlayer.style.display = 'block';
        imageViewer.style.display = 'none';
        videoPlayer.play();
    } else if (file.type.startsWith('image')) {
        imageViewer.src = fileUrl;
        imageViewer.style.display = 'block';
        videoPlayer.style.display = 'none';

        // Auto hide after 15 seconds
        imageTimeout = setTimeout(() => {
            imageViewer.style.display = 'none';
        }, 15000); // 15 detik
    }

    ipcRenderer.send('media-selected', {
        fileUrl,
        fileType: file.type
    });
});


// window.addEventListener('DOMContentLoaded', loadPlaylist);

window.addEventListener('DOMContentLoaded', () => {
    loadPlaylist();

    // videoPlayer.addEventListener('ended', () => {
    //     playItem((currentIndex + 1) % files.length);
    // });

    videoPlayer.addEventListener('ended', () => {
        logPlayback(currentFile, videoPlayer.duration * 1000, currentStartTime);
        playItem((currentIndex + 1) % files.length);
        console.log("Media selesai:", currentFile.name);
    });

    // ⏳ Tunggu sedikit agar loadPlaylist selesai isi `files[]`
    setTimeout(() => {
        if (files.length > 0) {
            playItem(0);
        }
    }, 100); // 100ms cukup untuk sync fill

    document.getElementById('sendToMiniBtn').addEventListener('click', () => {
        const x = parseInt(document.getElementById('inputX').value, 10);
        const y = parseInt(document.getElementById('inputY').value, 10);
        const w = parseInt(document.getElementById('inputW').value, 10);
        const h = parseInt(document.getElementById('inputH').value, 10);

        ipcRenderer.send('set-window-bounds', { x, y, width: w, height: h });
    });

});

// function playItem(index) {

//     console.log("PlayItem:", index, files[index]?.name);

//     if (index >= files.length) index = 0;
//     currentIndex = index;
//     const file = files[index];
//     const fileUrl = `file://${file.path}`;

//     // Reset
//     currentStartTime = new Date();
//     clearTimeout(imageTimeout);
//     clearInterval(imageProgressTimer);
//     videoTimeLabel.textContent = '00:00 / 00:00';
//     videoSlider.value = 0;
//     videoPlayer.pause();
//     videoPlayer.removeAttribute('src');
//     videoPlayer.load(); // reset
//     imageViewer.src = '';

//     if (file.type.startsWith('video')) {
//         videoPlayer.src = fileUrl;
//         videoPlayer.style.display = 'block';
//         imageViewer.style.display = 'none';
//         videoPlayer.play();
//         // } 
//         // else if (file.type.startsWith('image')) {
//         //     imageViewer.src = fileUrl;
//         //     imageViewer.style.display = 'block';
//         //     videoPlayer.style.display = 'none';

//         //     imageTimeout = setTimeout(() => {
//         //         playItem((currentIndex + 1) % files.length);
//         //     }, 15000); // 15 detik
//         // }

//     } else if (file.type.startsWith('image')) {
//         imageViewer.src = fileUrl;
//         imageViewer.style.display = 'block';
//         videoPlayer.style.display = 'none';

//         // Atur slider & waktu
//         videoSlider.style.display = 'block';
//         videoSlider.value = 0;
//         videoTimeLabel.style.display = 'block';
//         videoTimeLabel.textContent = `00:00 / ${formatTime(imageDuration / 1000)}`;

//         imageStartTime = Date.now();

//         // Auto-next setelah imageDuration
//         imageTimeout = setTimeout(() => {
//             clearInterval(imageProgressTimer);
//             logPlayback(currentFile, imageDuration, currentStartTime);
//             // playItem((currentIndex + 1) % files.length);
//             playItem((currentIndex + 1) % files.length);
//             console.log("Media selesai:", currentFile.name);
//         }, imageDuration);

//         // Update slider dan label tiap 200ms
//         imageProgressTimer = setInterval(() => {
//             const elapsed = Date.now() - imageStartTime;
//             // const percent = Math.min((elapsed / imageDuration) * 100, 100);
//             const percent = Math.min((elapsed / imageDuration) * 100, 100);
//             videoSlider.value = percent;

//             const nowSec = elapsed / 1000;
//             // videoTimeLabel.textContent = `${formatTime(nowSec)} / ${formatTime(imageDuration / 1000)}`;
//             videoTimeLabel.textContent = `${formatTime(elapsed / 1000)} / ${formatTime(imageDuration / 1000)}`;

//             if (elapsed >= imageDuration) {
//                 clearInterval(imageProgressTimer);
//                 playItem((currentIndex + 1) % files.length);
//             }
//         }, 200);
//     }

//     ipcRenderer.send('media-selected', {
//         fileUrl,
//         fileType: file.type
//     });
// }

function playItem(index) {
    if (index >= files.length) index = 0;
    currentIndex = index;
    const file = files[index];
    const fileUrl = `file://${file.path}`;
    currentFile = file; // ✅ penting untuk log
    currentStartTime = new Date();

    console.log("PlayItem:", index, file.name);

    // Reset semua
    clearTimeout(imageTimeout);
    clearInterval(imageProgressTimer);
    videoTimeLabel.textContent = '00:00 / 00:00';
    videoSlider.value = 0;

    videoPlayer.pause();
    videoPlayer.removeAttribute('src');
    videoPlayer.load();
    imageViewer.src = '';

    // 🔀 Deteksi jenis media
    if (file.type.startsWith('video')) {
        videoPlayer.src = fileUrl;
        videoPlayer.style.display = 'block';
        imageViewer.style.display = 'none';
        videoSlider.style.display = 'block';
        videoTimeLabel.style.display = 'block';

        videoPlayer.addEventListener('canplay', () => {
            videoPlayer.play().catch(err => {
                console.warn('Gagal play:', err.message);
            });
        }, { once: true });

    } else if (file.type.startsWith('image')) {
        imageViewer.src = fileUrl;
        imageViewer.style.display = 'block';
        videoPlayer.style.display = 'none';
        videoSlider.style.display = 'block';
        videoSlider.value = 0;
        videoTimeLabel.style.display = 'block';
        videoTimeLabel.textContent = `00:00 / ${formatTime(imageDuration / 1000)}`;

        imageStartTime = Date.now();

        imageTimeout = setTimeout(() => {
            clearInterval(imageProgressTimer);
            logPlayback(currentFile, imageDuration, currentStartTime);
            playItem((currentIndex + 1) % files.length);
            console.log("Image selesai:", currentFile.name);
        }, imageDuration);

        imageProgressTimer = setInterval(() => {
            const elapsed = Date.now() - imageStartTime;
            const percent = Math.min((elapsed / imageDuration) * 100, 100);
            videoSlider.value = percent;
            videoTimeLabel.textContent = `${formatTime(elapsed / 1000)} / ${formatTime(imageDuration / 1000)}`;

            if (elapsed >= imageDuration) {
                clearInterval(imageProgressTimer);
            }
        }, 200);
    }

    ipcRenderer.send('media-selected', {
        fileUrl,
        fileType: file.type
    });
}


document.getElementById('toggleOnTopBtn').addEventListener('click', () => {
    ipcRenderer.invoke('toggle-always-on-top').then((isOnTop) => {
        document.getElementById('onTopStatus').textContent = `Status: ${isOnTop ? 'ON' : 'OFF'}`;
    });
});

ipcRenderer.on('init-bounds', (event, bounds) => {
    document.getElementById('inputX').value = bounds.x;
    document.getElementById('inputY').value = bounds.y;
    document.getElementById('inputW').value = bounds.width;
    document.getElementById('inputH').value = bounds.height;
});

function getSelectedLineIndex() {
    const lines = playlistBox.value.split('\n');
    const caretPos = playlistBox.selectionStart;

    let charCount = 0;
    for (let i = 0; i < lines.length; i++) {
        charCount += lines[i].length + 1; // +1 untuk newline
        if (caretPos < charCount) return i;
    }
    return lines.length - 1;
}

function moveLine(direction) {
    const lines = playlistBox.value.split('\n');
    let index = getSelectedLineIndex();

    const target = direction === 'up' ? index - 1 : index + 1;

    if (target < 0 || target >= lines.length) return; // batas atas/bawah

    // Tukar isi baris
    [lines[index], lines[target]] = [lines[target], lines[index]];
    playlistBox.value = lines.join('\n');

    // Update cursor ke baris baru
    let cursorPos = 0;
    for (let i = 0; i < target; i++) {
        cursorPos += lines[i].length + 1;
    }
    playlistBox.selectionStart = playlistBox.selectionEnd = cursorPos;

    // Update playlist dan mulai ulang
    updatePlaylistFromText();
}

function updatePlaylistFromText() {
    const lines = playlistBox.value.split('\n').map(x => x.trim()).filter(x => x !== '');
    files.length = 0;

    lines.forEach(fp => {
        const name = path.basename(fp);
        const type = guessMimeType(fp);
        files.push({ name, path: fp, type });
    });

    savePlaylist();
    if (files.length > 0) playItem(0);
}

btnNaik.addEventListener('click', () => swapItems(selectedIndex, selectedIndex - 1));
btnTurun.addEventListener('click', () => swapItems(selectedIndex, selectedIndex + 1));

videoPlayer.addEventListener('timeupdate', () => {
    if (videoPlayer.duration) {
        videoSlider.value = (videoPlayer.currentTime / videoPlayer.duration) * 100;
    }
});
//  Seek saat slider digeser:
videoSlider.addEventListener('input', () => {
    if (videoPlayer.duration) {
        videoPlayer.currentTime = (videoSlider.value / 100) * videoPlayer.duration;
    }
});

function formatTime(seconds) {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

videoPlayer.addEventListener('timeupdate', () => {
    if (videoPlayer.duration) {
        const current = formatTime(videoPlayer.currentTime);
        const total = formatTime(videoPlayer.duration);
        videoTimeLabel.textContent = `${current} / ${total}`;
    }
});

videoSlider.addEventListener('input', () => {
    if (currentFile?.type.startsWith('video') && videoPlayer.duration) {
        videoPlayer.currentTime = (videoSlider.value / 100) * videoPlayer.duration;
    } else if (currentFile?.type.startsWith('image')) {
        // seek gambar: ubah timeout berdasarkan slider
        if (!imageStartTime) return;
        const elapsed = (videoSlider.value / 100) * imageDuration;

        clearTimeout(imageTimeout);
        clearInterval(imageProgressTimer);

        const remaining = imageDuration - elapsed;
        imageStartTime = Date.now() - elapsed;

        imageTimeout = setTimeout(() => {
            clearInterval(imageProgressTimer);
            playItem((currentIndex + 1) % files.length);
        }, remaining);

        // Restart progress bar
        imageProgressTimer = setInterval(() => {
            const elapsedNow = Date.now() - imageStartTime;
            const percent = Math.min((elapsedNow / imageDuration) * 100, 100);
            videoSlider.value = percent;

            const nowSec = elapsedNow / 1000;
            videoTimeLabel.textContent = `${formatTime(nowSec)} / ${formatTime(imageDuration / 1000)}`;

            if (elapsedNow >= imageDuration) {
                clearInterval(imageProgressTimer);
                playItem((currentIndex + 1) % files.length);
            }
        }, 200);
    }
});

const imageDurationInput = document.getElementById('imageDurationInput');
// let imageDuration = 15000; // default 15 detik (ms)

imageDurationInput.addEventListener('input', () => {
    const val = parseInt(imageDurationInput.value, 10);
    if (!isNaN(val) && val >= 3 && val <= 60) {
        imageDuration = val * 1000;
    }
});

function formatDateTime(date) {
    const pad = n => n.toString().padStart(2, '0');
    return {
        tanggal: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
        jam: `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
    };
}

// function logPlayback(file, durationMs, startTime) {
//     const endTime = new Date();
//     const { tanggal, jam: jamMulai } = formatDateTime(startTime);
//     const { jam: jamSelesai } = formatDateTime(endTime);
//     const durasiDetik = Math.round(durationMs / 1000);
//     const namaFile = file.name || path.basename(file.path);

//     playCount++;

//     const logLine = `${playCount},"${tanggal}","${namaFile}",${durasiDetik},${jamMulai},${jamSelesai}\n`;

//     // Tambahkan header jika file belum ada
//     if (!fs.existsSync(logPath)) {
//         const header = `No,Tanggal,Nama File,Durasi (detik),Jam Mulai,Jam Selesai\n`;
//         fs.writeFileSync(logPath, header + logLine);
//     } else {
//         fs.appendFileSync(logPath, logLine);
//     }
// }

function logPlayback(file, durationMs, startTime) {
    const endTime = new Date();
    const { tanggal, jam: jamMulai } = formatDateTime(startTime);
    const { jam: jamSelesai } = formatDateTime(endTime);
    const durasiDetik = Math.round(durationMs / 1000);
    const namaFile = file.name || path.basename(file.path);

    // 🔍 Cek nomor terakhir
    let lastNumber = 0;
    if (fs.existsSync(logPath)) {
        const lines = fs.readFileSync(logPath, 'utf8').split('\n');
        const lastLine = lines.reverse().find(line => line.trim() !== '' && !line.startsWith('No'));
        if (lastLine) {
            const firstValue = lastLine.split(',')[0];
            lastNumber = parseInt(firstValue, 10) || 0;
        }
    }

    const currentNumber = lastNumber + 1;
    const logLine = `${currentNumber},"${tanggal}","${namaFile}",${durasiDetik},${jamMulai},${jamSelesai}\n`;

    // 🧾 Tambahkan header jika belum ada file
    if (!fs.existsSync(logPath)) {
        const header = `No,Tanggal,Nama File,Durasi (detik),Jam Mulai,Jam Selesai\n`;
        fs.writeFileSync(logPath, header + logLine);
    } else {
        fs.appendFileSync(logPath, logLine);
    }

    console.log("Log playback:", logLine.trim());
}

document.getElementById('btnLaporan').addEventListener('click', () => {
    ipcRenderer.send('open-log-window');
});

btnHapusItem.addEventListener('click', () => {
    if (selectedIndex < 0 || selectedIndex >= files.length) {
        alert('Belum ada item yang dipilih!');
        return;
    }

    const hapusNama = files[selectedIndex].name;
    const konfirmasi = confirm(`Hapus "${hapusNama}" dari playlist?`);
    if (!konfirmasi) return;

    files.splice(selectedIndex, 1);

    if (files.length === 0) {
        selectedIndex = -1;
    } else if (selectedIndex >= files.length) {
        selectedIndex = files.length - 1;
    }

    savePlaylist();
    renderPlaylist();
});
