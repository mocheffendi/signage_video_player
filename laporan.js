const fs = require('fs');
const path = require('path');
const logPath = path.join(__dirname, 'log_playback.csv');

const tanggalDari = document.getElementById('tanggalDari');
const tanggalSampai = document.getElementById('tanggalSampai');
const filterBtn = document.getElementById('filterBtn');
const tbody = document.querySelector('#logTable tbody');

const { ipcRenderer } = require('electron');

let filteredData = [];

const XLSX = require('xlsx');

function parseCSV() {
    if (!fs.existsSync(logPath)) return [];

    const lines = fs.readFileSync(logPath, 'utf8').trim().split('\n');
    const data = lines.slice(1).map(line => {
        const [no, tanggal, nama, durasi, jamMulai, jamSelesai] = line.split(',');
        return {
            no,
            tanggal: tanggal.replace(/"/g, ''),
            nama: nama.replace(/"/g, ''),
            durasi,
            jamMulai,
            jamSelesai
        };
    });

    return data;
}

function renderTable(data) {
    tbody.innerHTML = '';
    data.forEach(row => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
      <td>${row.no}</td>
      <td>${row.tanggal}</td>
      <td>${row.nama}</td>
      <td>${row.durasi}</td>
      <td>${row.jamMulai}</td>
      <td>${row.jamSelesai}</td>
    `;
        tbody.appendChild(tr);
    });
}

filterBtn.addEventListener('click', () => {
    const dari = tanggalDari.value;
    const sampai = tanggalSampai.value;

    const all = parseCSV();
    const filtered = all.filter(row => {
        return (!dari || row.tanggal >= dari) && (!sampai || row.tanggal <= sampai);
    });

    renderTable(filtered);

    // ✅ simpan data untuk export
    filteredData = filtered;
});

// Auto load semua saat buka
renderTable(parseCSV());

// document.getElementById('exportBtn').addEventListener('click', () => {
//     if (filteredData.length === 0) {
//         alert('Tidak ada data untuk diekspor!');
//         return;
//     }

//     ipcRenderer.invoke('show-save-dialog').then(filePath => {
//         if (!filePath) return;

//         const content = [
//             'No,Tanggal,Nama File,Durasi (detik),Jam Mulai,Jam Selesai',
//             ...filteredData.map(row =>
//                 `${row.no},"${row.tanggal}","${row.nama}",${row.durasi},${row.jamMulai},${row.jamSelesai}`
//             )
//         ].join('\n');

//         fs.writeFileSync(filePath, content);
//         alert('Laporan berhasil disimpan!');
//     });
// });

document.getElementById('exportBtn').addEventListener('click', () => {
    if (filteredData.length === 0) {
        alert('Tidak ada data untuk diekspor!');
        return;
    }

    ipcRenderer.invoke('show-save-dialog-xlsx').then(filePath => {
        if (!filePath) return;

        // Buat array data untuk worksheet
        const dataSheet = [
            ['No', 'Tanggal', 'Nama File', 'Durasi (detik)', 'Jam Mulai', 'Jam Selesai'],
            ...filteredData.map(row => [
                parseInt(row.no),
                row.tanggal,
                row.nama,
                parseInt(row.durasi),
                row.jamMulai,
                row.jamSelesai
            ])
        ];

        // Buat workbook
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(dataSheet);
        XLSX.utils.book_append_sheet(wb, ws, "Laporan");

        // Tulis file
        XLSX.writeFile(wb, filePath);

        alert('Laporan berhasil disimpan sebagai Excel!');
    });
});


