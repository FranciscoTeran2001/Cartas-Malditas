import { cargarPerks, sacarCartas, elegirPorTiempo } from './mazo.js';
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
let historial = [];       // { elegida, otras } por ronda, para el resumen final
let comodinUsado = false; // el Gato de la Suerte sale como mucho una vez por build
let rondaSuerte = false;

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
function crearCarta(perk, indice, bocaArriba) {
    const carta = document.createElement('button');
    carta.className = 'carta repartida';
    if (bocaArriba) carta.classList.add('volteada');
    if (perk.castigo) carta.classList.add('es-castigo');
    if (perk.agotamiento) carta.classList.add('es-agotamiento');
    if (perk.comodin) carta.classList.add('es-comodin');
    // Boca abajo sin el nombre de la perk: la carta es sorpresa hasta elegirla
    carta.setAttribute('aria-label', bocaArriba ? `${perk.nombre} (tecla ${indice + 1})` : `Carta ${indice + 1}`);
    carta.innerHTML = `
        <div class="carta-inner">
            <div class="cara dorso">
                <span class="tecla">${indice + 1}</span>
                <div class="ojo"></div>
                <span class="huellas">🐾</span>
            </div>
            <div class="cara frente">
                ${bocaArriba ? `<span class="tecla">${indice + 1}</span>` : ''}
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

// suerte: ronda del comodín, 3 cartas boca arriba y sin tiempo
async function nuevaRonda(suerte = false) {
    rondaSuerte = suerte;
    par = sacarCartas(perks, build, { cantidad: suerte ? 3 : 2, suerte, comodinUsado });
    mesa.innerHTML = '';
    mesa.classList.toggle('mesa-suerte', suerte);
    par.forEach((perk, i) => mesa.appendChild(crearCarta(perk, i, suerte)));

    // Las cartas llegan a la mesa (animación .repartida en CSS)
    for (let i = 0; i < par.length; i++) {
        playFlip();
        await delay(200);
    }
    await delay(250);
    eligiendo = true;

    if (suerte) {
        barra.style.width = '100%';
        barra.classList.remove('urgente');
        barra.classList.add('suerte');
        textoTiempo.innerText = '🍀';
    } else {
        barra.classList.remove('suerte');
        iniciarTimer(TIEMPOS_MS[Math.min(build.length, TIEMPOS_MS.length - 1)]);
    }
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

async function elegir(indice, porTiempo = false) {
    if (!eligiendo || indice >= par.length) return;
    eligiendo = false;
    cancelAnimationFrame(timerId);

    const perk = par[indice];
    const cartas = [...mesa.querySelectorAll('.carta')];
    cartas.forEach(c => { c.disabled = true; });
    historial.push({ elegida: perk, otras: par.filter((_, i) => i !== indice) });

    // Primero se voltea la elegida y luego las otras, para ver lo que te perdiste
    cartas[indice].classList.add('elegida', 'volteada');
    if (!rondaSuerte) playFlip();
    await delay(700);

    if (perk.comodin) {
        comodinUsado = true;
        playSuerte();
        const castigo = build.findIndex(p => p.castigo);
        if (castigo !== -1) {
            const liberada = build.splice(castigo, 1)[0];
            actualizarSlots();
            mostrarToast(`🍀 ¡Gato de la Suerte! Se llevó tu "${liberada.nombre}". Elige libre entre 3`, 'success');
        } else {
            mostrarToast('🍀 ¡Gato de la Suerte! Elige libre entre 3 cartas, sin tiempo', 'success');
        }
    } else if (perk.castigo) {
        playCastigo();
        mostrarToast(porTiempo
            ? `😾 ¡El gato se impacientó! Te tocó "${perk.nombre}" y no se puede quitar`
            : `😈 Elegiste "${perk.nombre}"... no se puede quitar`, 'warn');
    } else {
        playMaullido();
        if (porTiempo) mostrarToast(`⏰ Se acabó el tiempo: te tocó "${perk.nombre}"`, 'info');
    }

    if (!perk.comodin) {
        build.push(perk);
        actualizarSlots();
    }

    await delay(600);
    cartas.forEach((c, i) => { if (i !== indice) c.classList.add('descartada', 'volteada'); });
    await delay(1400);

    if (perk.comodin) return nuevaRonda(true);
    if (build.length >= TAMANO_BUILD) return mostrarResumen();
    nuevaRonda();
}

function mostrarResumen() {
    const filas = historial.map(({ elegida, otras }, i) => `
        <li>
            <span class="ronda">${i + 1}</span>
            <span class="ganada">✅ ${elegida.comodin ? '🍀 ' : ''}${elegida.castigo ? '😈 ' : ''}${elegida.nombre}</span>
            <span class="perdida">❌ ${otras.map(p => p.nombre).join(' / ')}</span>
        </li>
    `).join('');

    mesa.classList.remove('mesa-suerte');
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

// Teclas 1, 2 y 3 (o flechas) para elegir
document.addEventListener('keydown', (e) => {
    if (e.key === '1' || e.key === 'ArrowLeft') elegir(0);
    if (e.key === '2' || e.key === 'ArrowRight') elegir(1);
    if (e.key === '3') elegir(2);
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
