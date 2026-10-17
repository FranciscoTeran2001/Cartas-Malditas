import { cargarPerks, sacarCartas, elegirPorTiempo, perkDeLaSuerte } from './mazo.js';
import { playFlip, playTick, playMaullido, playCastigo, playSuerte } from './sonidos.js';

// El tiempo baja en cada ronda: más presión, más fácil que el gato se impaciente
const TIEMPOS_MS = [6000, 5000, 4000, 3000];
const TAMANO_BUILD = 4;

const mesa = document.getElementById('mesa');
const slotsContainer = document.getElementById('slotsContainer');
const barra = document.getElementById('barraTiempo');
const textoTiempo = document.getElementById('textoTiempo');
const btnEmpezar = document.getElementById('btnEmpezar');
const btnReiniciar = document.getElementById('btnReiniciar');

let perks = [];
let build = [];
let par = [];
let eligiendo = false;
let timerId = null;
let historial = [];       // { elegida, otras, nota } por ronda, para el resumen final
let comodinUsado = false; // el Gato de la Suerte sale como mucho una vez por build

// ─── Toast de notificación ────────────────────────────────────────────────────
function mostrarToast(mensaje, tipo = 'info') {
    const anterior = document.getElementById('toastNotif');
    if (anterior) anterior.remove();

    const toast = document.createElement('div');
    toast.id = 'toastNotif';
    toast.className = `toast toast-${tipo}`;
    toast.innerText = mensaje;
    document.body.appendChild(toast);
    requestAnimationFrame(() => requestAnimationFrame(() => toast.classList.add('visible')));
    setTimeout(() => {
        toast.classList.remove('visible');
        setTimeout(() => toast.remove(), 400);
    }, 2500);
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── Build (panel izquierdo) ──────────────────────────────────────────────────
function actualizarSlots() {
    slotsContainer.innerHTML = '';
    for (let i = 0; i < TAMANO_BUILD; i++) {
        const perk = build[i];
        const slot = document.createElement('div');
        slot.className = perk ? `build-slot filled${perk.castigo ? ' castigo' : ''}` : 'build-slot';

        if (perk) {
            slot.innerHTML = `
                <img src="${perk.pathImagen}" alt="">
                <span>${perk.nombre}</span>
            `;
        } else {
            slot.innerText = `${i + 1}. Vacío`;
        }
        slotsContainer.appendChild(slot);
    }
}

// ─── Cartas ───────────────────────────────────────────────────────────────────
function crearCarta(perk, indice) {
    const carta = document.createElement('button');
    carta.className = 'carta repartida';
    if (perk.castigo) carta.classList.add('es-castigo');
    if (perk.agotamiento) carta.classList.add('es-agotamiento');
    if (perk.comodin) carta.classList.add('es-comodin');
    // Sin el nombre de la perk: la carta es sorpresa hasta elegirla
    carta.setAttribute('aria-label', `Carta ${indice + 1}`);
    carta.innerHTML = `
        <div class="carta-inner">
            <div class="cara dorso">
                <span class="tecla">${indice + 1}</span>
                <div class="ojo"></div>
                <span class="huellas">🐾</span>
            </div>
            <div class="cara frente">
                ${perk.castigo ? '<span class="etiqueta etiqueta-castigo">😈 Castigo</span>' : ''}
                ${perk.agotamiento ? '<span class="etiqueta etiqueta-agotamiento">⚡ Agotamiento</span>' : ''}
                ${perk.comodin ? '<span class="etiqueta etiqueta-comodin">🍀 Comodín</span><span class="comodin-icono">🐈‍⬛</span>'
                               : `<img src="${perk.pathImagen}" alt="">`}
                <strong>${perk.nombre}</strong>
                <small>${perk.superviviente}</small>
            </div>
        </div>
    `;
    carta.addEventListener('click', () => elegir(indice));
    return carta;
}

async function nuevaRonda() {
    par = sacarCartas(perks, build, { comodinUsado });
    mesa.innerHTML = '';
    par.forEach((perk, i) => mesa.appendChild(crearCarta(perk, i)));

    // Las cartas llegan boca abajo (animación .repartida en CSS)
    playFlip();
    await delay(200);
    playFlip();
    await delay(450);
    eligiendo = true;
    iniciarTimer(TIEMPOS_MS[Math.min(build.length, TIEMPOS_MS.length - 1)]);
}

function iniciarTimer(duracion) {
    const inicio = performance.now();
    let ultimoSegundo = null;

    function actualizar(ahora) {
        const restante = Math.max(duracion - (ahora - inicio), 0);
        const segundos = Math.ceil(restante / 1000);
        barra.style.width = `${(restante / duracion) * 100}%`;
        barra.classList.toggle('urgente', segundos <= 3);
        textoTiempo.innerText = `${segundos}s`;

        if (segundos !== ultimoSegundo && segundos <= 3 && segundos > 0) playTick();
        ultimoSegundo = segundos;

        if (restante === 0) {
            elegir(elegirPorTiempo(par), true);
        } else {
            timerId = requestAnimationFrame(actualizar);
        }
    }
    timerId = requestAnimationFrame(actualizar);
}

// Gato de la Suerte: quita "Me la pela" si lo tienes; si no, regala una de las mejores perks
function usarComodin() {
    comodinUsado = true;
    playSuerte();

    const castigo = build.findIndex(p => p.castigo);
    if (castigo !== -1) {
        const liberada = build.splice(castigo, 1)[0];
        mostrarToast(`🍀 ¡Gato de la Suerte! Se llevó tu "${liberada.nombre}"`, 'success');
        return `se llevó ${liberada.nombre}`;
    }

    const premio = perkDeLaSuerte(perks, build);
    if (!premio) return 'no encontró nada que regalar';
    build.push(premio);
    mostrarToast(`🍀 ¡Gato de la Suerte! Te regaló "${premio.nombre}"`, 'success');
    return `te regaló ${premio.nombre}`;
}

async function elegir(indice, porTiempo = false) {
    if (!eligiendo || indice >= par.length) return;
    eligiendo = false;
    cancelAnimationFrame(timerId);

    const perk = par[indice];
    const cartas = [...mesa.querySelectorAll('.carta')];
    cartas.forEach(c => { c.disabled = true; });
    const ronda = { elegida: perk, otras: par.filter((_, i) => i !== indice) };
    historial.push(ronda);

    // Primero se voltea la elegida y luego la otra, para ver lo que te perdiste
    cartas[indice].classList.add('elegida', 'volteada');
    playFlip();
    await delay(700);

    if (perk.comodin) {
        ronda.nota = usarComodin();
    } else if (perk.castigo) {
        playCastigo();
        mostrarToast(porTiempo
            ? `😾 ¡El gato se impacientó! Te tocó "${perk.nombre}" y no se puede quitar`
            : `😈 Elegiste "${perk.nombre}"... no se puede quitar`, 'warn');
        build.push(perk);
    } else {
        playMaullido();
        if (porTiempo) mostrarToast(`⏰ Se acabó el tiempo: te tocó "${perk.nombre}"`, 'info');
        build.push(perk);
    }
    actualizarSlots();

    await delay(600);
    cartas.forEach((c, i) => { if (i !== indice) c.classList.add('descartada', 'volteada'); });
    await delay(1400);

    if (build.length >= TAMANO_BUILD) return mostrarResumen();
    nuevaRonda();
}

function mostrarResumen() {
    const filas = historial.map(({ elegida, otras, nota }, i) => `
        <li>
            <span class="ronda">${i + 1}</span>
            <span class="ganada">✅ ${elegida.comodin ? '🍀 ' : ''}${elegida.castigo ? '😈 ' : ''}${elegida.nombre}${nota ? ` <em>(${nota})</em>` : ''}</span>
            <span class="perdida">❌ ${otras.map(p => p.nombre).join(' / ')}</span>
        </li>
    `).join('');

    mesa.innerHTML = `
        <div class="resumen">
            <h2>🐈‍⬛ ¡Build completa! 🐈‍⬛</h2>
            <p>Lo que elegiste… y lo que te perdiste</p>
            <ol>${filas}</ol>
        </div>
    `;
    textoTiempo.innerText = '';
    barra.style.width = '0%';
    btnReiniciar.hidden = false;
    mostrarToast('✅ ¡Build completa!', 'success');
}

// ─── Controles ────────────────────────────────────────────────────────────────
btnEmpezar.addEventListener('click', () => {
    btnEmpezar.hidden = true;
    nuevaRonda();
});

btnReiniciar.addEventListener('click', () => {
    build = [];
    historial = [];
    comodinUsado = false;
    actualizarSlots();
    btnReiniciar.hidden = true;
    nuevaRonda();
});

// Teclas 1 y 2 (o flechas) para elegir
document.addEventListener('keydown', (e) => {
    if (e.key === '1' || e.key === 'ArrowLeft') elegir(0);
    if (e.key === '2' || e.key === 'ArrowRight') elegir(1);
});

async function init() {
    actualizarSlots();
    try {
        perks = await cargarPerks();
    } catch (error) {
        console.error(error);
        btnEmpezar.disabled = true;
        mostrarToast('❌ No se pudieron cargar las perks', 'warn');
    }
}

init();
