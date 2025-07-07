const miaudio = document.getElementById('mi');
const maudio = document.getElementById('mu');
const yearSelect = document.getElementById('year');
const filesSelect = document.getElementById('files');
const mmaSelect = document.getElementById('mma');
const playPauseBtn = document.getElementById('play-pause');
const timeSlider = document.getElementById('time-slider');
const volumeSlider = document.getElementById('volume-slider');
const currentTimeDisplay = document.getElementById('current-time');
const totalTimeDisplay = document.getElementById('total-time');
const soloBtn = document.getElementById('solo-btn');
const captionElement = document.getElementById('caption');

let isUserScrolling = false;
let scrollTimeout;
let isProgrammaticScroll = false;

let currentYear = '2025';
let currentSong = null;
let running = false;
let autoPlay = true;
let captions = {};
let formattedCaptions = {};
let solo = {
    start: null,
    end: null,
    status: 'inactive',
    songId: null
};

init();

function init() {
    loadSoloSettings();
    miaudio.volume = 0.5;
    maudio.volume = 0.5;
    volumeSlider.value = 50;
    addEventListeners();
    updateControlsDisabledState();
}

function addEventListeners() {
    yearSelect.addEventListener('change', handleYearChange);
    filesSelect.addEventListener('change', handleSongChange);
    mmaSelect.addEventListener('change', handlePlaybackModeChange);
    playPauseBtn.addEventListener('click', togglePlayPause);
    timeSlider.addEventListener('input', handleTimeSliderInput);
    volumeSlider.addEventListener('input', handleVolumeChange);
    miaudio.addEventListener('timeupdate', updatePlayerUI);
    miaudio.addEventListener('loadedmetadata', updateDurationDisplay);
    miaudio.addEventListener('ended', handleAudioEnded);
    maudio.addEventListener('ended', handleAudioEnded);
    soloBtn.addEventListener('click', handleSoloButtonClick);
}

function updateControlsDisabledState() {
    const mode = mmaSelect.value;
    const disabled = (mode === 'null' || mode === '' || mode == null);

    playPauseBtn.disabled = disabled;
    timeSlider.disabled = disabled;
}

function handleYearChange(e) {
    currentYear = e.target.value;
}

function handleSongChange(e) {
    const songId = e.target.value;
    if (songId === 'null') return;

    currentSong = songId;

    loadLyrics(`caption/${songId}3.txt`);

    updateControlsDisabledState();

    if (mmaSelect.value === 'null' || mmaSelect.value === 'lyr') return;

    running = false;
    miaudio.src = `files/${songId}1.mp3`;
    maudio.src = `files/${songId}2.mp3`;

    if (solo.songId !== songId) resetSolo();

    miaudio.muted = false;
    maudio.muted = true;

    if (autoPlay) playAudio();
    else updatePlayPauseButton(false);
}

function handlePlaybackModeChange(e) {
    const mode = e.target.value;
    updateControlsDisabledState();

    if (!currentSong || currentSong === 'null') return;

    if (mode === 'mi') {
        maudio.muted = true;
        miaudio.muted = false;
    } else if (mode === 'm') {
        maudio.muted = false;
        miaudio.muted = true;
    } else if (mode === 'lyr') {
        pauseAudio();
        return;
    } else {
        pauseAudio();
        return;
    }

    if (!miaudio.src || !maudio.src) {
        miaudio.src = `files/${currentSong}1.mp3`;
        maudio.src = `files/${currentSong}2.mp3`;
    }

    if (autoPlay) playAudio();
    else updatePlayPauseButton(false);

    if (solo.status === 'active' && solo.songId === currentSong) saveSoloSettings();
}

function togglePlayPause() {
    if (miaudio.paused) playAudio();
    else pauseAudio();
}

function playAudio() {
    miaudio.play().catch(e => console.error('Error playing audio:', e));
    maudio.play().catch(e => console.error('Error playing audio:', e));
    updatePlayPauseButton(true);
    running = true;
}

function pauseAudio() {
    miaudio.pause();
    maudio.pause();
    updatePlayPauseButton(false);
}

function updatePlayPauseButton(isPlaying) {
    const icon = playPauseBtn.querySelector('i');
    icon.className = isPlaying ? 'bi bi-pause-fill' : 'bi bi-play-fill';
}

function handleTimeSliderInput(e) {
    const seekTime = (e.target.value / 100) * miaudio.duration;
    miaudio.currentTime = seekTime;
    maudio.currentTime = seekTime;
}

function handleVolumeChange(e) {
    const volume = e.target.value / 100;
    miaudio.volume = volume;
    maudio.volume = volume;
}

function updatePlayerUI() {
    if (!miaudio.duration) return;
    const progress = (miaudio.currentTime / miaudio.duration) * 100;
    timeSlider.value = progress;
    currentTimeDisplay.textContent = formatTime(miaudio.currentTime);
    highlightCurrentLyrics();
    if (solo.status === 'active' && solo.songId === currentSong) handleSoloPlayback();
}

function updateDurationDisplay() {
    totalTimeDisplay.textContent = formatTime(miaudio.duration);
}

function formatTime(seconds) {
    if (isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

function handleAudioEnded() {
    running = false;
    updatePlayPauseButton(false);
}

async function loadLyrics(url) {
    try {
        const response = await fetch(url);
        const text = await response.text();
        captions = {};
        formattedCaptions = {};
        captionElement.innerHTML = '';
        let lastSeconds = 0;
        let isNewLine = false;
        text.split('\n').forEach(line => {
            if (line.trim() === '') {
                captions[lastSeconds + 1] = '';
                isNewLine = true;
                captionElement.innerHTML += '<br>';
                return;
            }
            const [timeStr, ...lyricParts] = line.split(' ');
            const lyric = lyricParts.join(' ');
            const [mins, secs] = timeStr.split(':').map(Number);
            const seconds = mins * 60 + secs;
            lastSeconds = seconds;
            captions[seconds] = lyric;
            formattedCaptions[seconds] = isNewLine ? '<br>' + lyric : lyric;
            isNewLine = false;
            let lineElement = document.createElement('span');
            lineElement.className = 'line';
            lineElement.textContent = lyric;
            lineElement.dataset.time = seconds;
            captionElement.appendChild(lineElement);
            captionElement.appendChild(document.createElement('br'));
            lineElement.setAttribute('onclick', `seekToLyric(${seconds})`)
        });
    } catch (error) {
        console.error('Error loading lyrics:', error);
        captionElement.textContent = 'حدث خطأ في تحميل كلمات الأغنية';
    }
}

function seekToLyric(time) {
    if (solo.status === 'selecting-start' || solo.status === 'selecting-end') {
        handleLyricClickForSolo(time);
        return;
    }
    miaudio.currentTime = time;
    maudio.currentTime = time;
    if (miaudio.paused) playAudio();
}

function highlightCurrentLyrics() {
    const currentTime = miaudio.currentTime;
    const lines = Array.from(captionElement.querySelectorAll('.line'));
    const times = lines.map(line => parseFloat(line.dataset.time));
    let closestTime = null;
    let minDiff = Infinity;
    times.forEach(time => {
        if (time <= currentTime) {
            const diff = currentTime - time;
            if (diff < minDiff) {
                minDiff = diff;
                closestTime = time;
            }
        }
    });

    lines.forEach(line => line.classList.remove('highlight'));

    if (closestTime !== null) {
        lines.forEach(line => {
            if (parseFloat(line.dataset.time) === closestTime) {
                line.classList.add('highlight');
                if (!isUserScrolling) {
                    isProgrammaticScroll = true;
                    line.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    setTimeout(() => isProgrammaticScroll = false, 50);
                }
            }
        });
    } else {
        let line = document.querySelector(".line");
        if(line) {
            line.classList.add('highlight');
            if (!isUserScrolling) {
                isProgrammaticScroll = true;
                line.scrollIntoView({ behavior: 'smooth', block: 'center' });
                setTimeout(() => isProgrammaticScroll = false, 50);
            }
        }
    }
}

function handleSoloButtonClick() {
    if (solo.status === 'active') {
        resetSolo();
        return;
    }
    if (!currentSong) {
        alert('الرجاء اختيار ترنيمة أولاً');
        return;
    }
    solo.status = 'selecting-start';
    soloBtn.classList.add('active');
    soloBtn.innerHTML = '<i class="bi bi-mic-fill"></i> انقر على بداية الصولو';
    autoPlay = false;
    if (!miaudio.paused) pauseAudio();
    alert('الرجاء النقر على السطر الذي يحدد بداية الصولو');
}

function handleLyricClickForSolo(time) {
    if (solo.status === 'selecting-start') {
        solo.start = time;
        solo.status = 'selecting-end';
        soloBtn.innerHTML = '<i class="bi bi-mic-fill"></i> انقر على نهاية الصولو';
        alert('الآن الرجاء النقر على السطر التي يلي نهاية الصولو');
    } else if (solo.status === 'selecting-end') {
        solo.end = time;
        solo.status = 'active';
        solo.songId = currentSong;
        soloBtn.innerHTML = '<i class="bi bi-mic-fill"></i> إزالة الصولو';
        saveSoloSettings();
        autoPlay = true;
        playAudio();
    }
}

function handleSoloPlayback() {
    const currentTime = miaudio.currentTime;
    if (currentTime >= solo.start && currentTime <= solo.end) {
        maudio.muted = false;
        miaudio.muted = true;
    } else {
        maudio.muted = true;
        miaudio.muted = false;
    }
}

function loadSoloSettings() {
    const soloCookie = getCookie('solo');
    if (soloCookie) {
        const [songId, start, end] = soloCookie.split(':');
        solo = {
            start: parseFloat(start),
            end: parseFloat(end),
            status: 'active',
            songId: songId
        };
        soloBtn.classList.add('active');
        soloBtn.innerHTML = '<i class="bi bi-mic-fill"></i> إزالة الصولو';
    }
}

function saveSoloSettings() {
    const cookieValue = `${solo.songId}:${solo.start}:${solo.end}`;
    document.cookie = `solo=${cookieValue}; path=/; max-age=${60 * 60 * 24 * 30}`;
}

function resetSolo() {
    solo = { start: null, end: null, status: 'inactive', songId: null };
    soloBtn.classList.remove('active');
    soloBtn.innerHTML = '<i class="bi bi-mic-fill"></i> تحديد الصولو';
    document.cookie = 'solo=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    maudio.muted = true;
    miaudio.muted = false;
}

function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
}

document.querySelector(".lyrics-container").addEventListener('scroll', e => {
    if (isProgrammaticScroll) return isProgrammaticScroll = false;
    isUserScrolling = true;
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
        isUserScrolling = false;
    }, 2000);
});
