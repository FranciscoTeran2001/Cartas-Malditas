// ─── Sonidos generados con Web Audio (sin archivos) ──────────────────────────
let audioCtx = null;

function getAudioCtx() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    return audioCtx;
}

// Roce de carta al voltearse (ráfaga corta de ruido)
export function playFlip() {
    const ac = getAudioCtx();
    const dur = 0.12;
    const buffer = ac.createBuffer(1, ac.sampleRate * dur, ac.sampleRate);
    const datos = buffer.getChannelData(0);
    for (let i = 0; i < datos.length; i++) datos[i] = (Math.random() * 2 - 1) * (1 - i / datos.length);

    const ruido = ac.createBufferSource();
    const filtro = ac.createBiquadFilter();
    const gain = ac.createGain();
    ruido.buffer = buffer;
    filtro.type = 'highpass';
    filtro.frequency.value = 2000;
    gain.gain.value = 0.25;
    ruido.connect(filtro);
    filtro.connect(gain);
    gain.connect(ac.destination);
    ruido.start();
}

// Tick de reloj en los últimos segundos
export function playTick() {
    const ac = getAudioCtx();
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.connect(gain);
    gain.connect(ac.destination);

    osc.type = 'square';
    osc.frequency.setValueAtTime(880, ac.currentTime);
    gain.gain.setValueAtTime(0.08, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.08);

    osc.start(ac.currentTime);
    osc.stop(ac.currentTime + 0.08);
}

// Maullido al elegir carta: tono que sube y baja ("miau") con filtro que imita la boca
export function playMaullido() {
    const ac = getAudioCtx();
    const t = ac.currentTime;
    const osc = ac.createOscillator();
    const filtro = ac.createBiquadFilter();
    const gain = ac.createGain();
    osc.connect(filtro);
    filtro.connect(gain);
    gain.connect(ac.destination);

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(480, t);
    osc.frequency.linearRampToValueAtTime(820, t + 0.18);
    osc.frequency.linearRampToValueAtTime(420, t + 0.65);

    filtro.type = 'bandpass';
    filtro.Q.value = 4;
    filtro.frequency.setValueAtTime(900, t);
    filtro.frequency.linearRampToValueAtTime(2000, t + 0.2);
    filtro.frequency.linearRampToValueAtTime(700, t + 0.65);

    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.3, t + 0.06);
    gain.gain.setValueAtTime(0.3, t + 0.45);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.7);

    osc.start(t);
    osc.stop(t + 0.7);
}

// Arpegio brillante cuando sale el Gato de la Suerte
export function playSuerte() {
    const ac = getAudioCtx();
    const notas = [523.25, 659.25, 783.99, 1046.5, 1318.5]; // C5 E5 G5 C6 E6
    notas.forEach((freq, i) => {
        const osc  = ac.createOscillator();
        const gain = ac.createGain();
        osc.connect(gain);
        gain.connect(ac.destination);

        osc.type = 'triangle';
        const t = ac.currentTime + i * 0.08;
        osc.frequency.setValueAtTime(freq, t);

        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.2, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);

        osc.start(t);
        osc.stop(t + 0.6);
    });
}

// Trombón triste (wah wah wah waaah) cuando toca "Me la pela"
export function playCastigo() {
    const ac = getAudioCtx();
    const notas = [293.66, 277.18, 261.63, 246.94]; // D4 C#4 C4 B3
    notas.forEach((freq, i) => {
        const ultima = i === notas.length - 1;
        const osc    = ac.createOscillator();
        const filtro = ac.createBiquadFilter();
        const gain   = ac.createGain();
        osc.connect(filtro);
        filtro.connect(gain);
        gain.connect(ac.destination);

        osc.type = 'sawtooth';
        filtro.type = 'lowpass';
        filtro.frequency.value = 1200;

        const t = ac.currentTime + i * 0.4;
        const dur = ultima ? 1.2 : 0.35;
        osc.frequency.setValueAtTime(freq, t);

        if (ultima) {
            // Vibrato en la última nota
            const lfo     = ac.createOscillator();
            const lfoGain = ac.createGain();
            lfo.frequency.value = 6;
            lfoGain.gain.value = 6;
            lfo.connect(lfoGain);
            lfoGain.connect(osc.frequency);
            lfo.start(t);
            lfo.stop(t + dur);
        }

        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.18, t + 0.05);
        gain.gain.setValueAtTime(0.18, t + dur - 0.15);
        gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

        osc.start(t);
        osc.stop(t + dur);
    });
}
