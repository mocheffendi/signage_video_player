const { ipcRenderer } = require('electron');
const video = document.getElementById('miniVideo');
const image = document.getElementById('miniImage');

let imageTimeout;

ipcRenderer.on('play-media', (event, data) => {
    const { fileUrl, fileType } = data;

    clearTimeout(imageTimeout);
    video.pause();
    video.removeAttribute('src');
    image.src = '';

    if (fileType.startsWith('video')) {
        video.src = fileUrl;
        video.style.display = 'block';
        image.style.display = 'none';
        video.play();
    } else {
        image.src = fileUrl;
        image.style.display = 'block';
        video.style.display = 'none';

        imageTimeout = setTimeout(() => {
            image.style.display = 'none';
        }, 15000); // 15 detik
    }
});
