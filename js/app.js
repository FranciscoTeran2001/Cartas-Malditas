import { cargarPerks, sacarCartas, elegirPorTiempo, perksDeLaSuerte } from './mazo.js';
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
// Orejas en SVG: la izquierda tiene una muesca (gato callejero que ha peleado)
const PELO_OREJA = '<path class="pelo" d="M14 48 L16 34 M19 48 L19 30 M24 48 L22 35"/>';
const INTERIOR_OREJA = '<path class="interior" d="M9 50 C10 34 13 20 18 10 C23 20 28 34 31 50 Z"/>';
const OREJAS = `
    <span class="oreja oreja-izq"><svg viewBox="0 0 40 50" aria-hidden="true">
        <path class="exterior" d="M2 50 C3 40 4 33 6 27 L11 25 L8 20 C10 12 13 6 16 2 C18 0 21 0 22 2 C30 14 36 32 38 50 Z"/>
        ${INTERIOR_OREJA}${PELO_OREJA}
        <circle cx="7" cy="31" r="1.4" fill="#c0392b"/>
    </svg></span>
    <span class="oreja oreja-der"><svg viewBox="0 0 40 50" aria-hidden="true">
        <path class="exterior" d="M2 50 C3 30 8 12 16 2 C18 0 21 0 22 2 C30 14 36 32 38 50 Z"/>
        ${INTERIOR_OREJA}${PELO_OREJA}
    </svg></span>
`;

function crearCarta(perk, indice, bocaArriba) {
    const carta = document.createElement('button');
    carta.className = 'carta repartida';
    if (bocaArriba) carta.classList.add('volteada');
    if (perk.castigo) carta.classList.add('es-castigo');
    if (perk.agotamiento) carta.classList.add('es-agotamiento');
    if (perk.comodin) carta.classList.add('es-comodin');
    // Boca abajo sin el nombre de la perk: la carta es sorpresa hasta elegirla
    carta.setAttribute('aria-label', bocaArriba ? perk.nombre : `Carta ${indice + 1}`);
    carta.innerHTML = `
        ${OREJAS}
        <div class="carta-inner">
            <div class="cara dorso">
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

// suerte: ronda del comodín, 3 de las mejores perks boca arriba y sin tiempo
async function nuevaRonda(suerte = false) {
    par = suerte ? perksDeLaSuerte(perks, build) : sacarCartas(perks, build, { comodinUsado });
    rondaSuerte = suerte && par.length > 0;
    if (suerte && !rondaSuerte) par = sacarCartas(perks, build, { comodinUsado });

    mesa.innerHTML = '';
    mesa.classList.toggle('mesa-suerte', rondaSuerte);
    par.forEach((perk, i) => mesa.appendChild(crearCarta(perk, i, rondaSuerte)));

    // Las cartas llegan a la mesa (animación .repartida en CSS)
    for (let i = 0; i < par.length; i++) {
        playFlip();
        await delay(200);
    }
    await delay(250);
    eligiendo = true;

    barra.classList.toggle('suerte', rondaSuerte);
    if (rondaSuerte) {
        barra.classList.remove('urgente');
        barra.style.width = '100%';
        textoTiempo.innerText = '🍀';
    } else {
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
        mesa.classList.toggle('gato-enojado', segundos <= 3 && restante > 0);
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

// Gato de la Suerte: quita "Me la pela" si lo tienes; si no, toca elegir entre 3 de las mejores.
// Devuelve true si hay que jugar la ronda de la suerte.
function usarComodin(ronda) {
    comodinUsado = true;
    playSuerte();

    const castigo = build.findIndex(p => p.castigo);
    if (castigo !== -1) {
        const liberada = build.splice(castigo, 1)[0];
        mostrarToast(`🍀 ¡Gato de la Suerte! Se llevó tu "${liberada.nombre}"`, 'success');
        ronda.nota = `se llevó ${liberada.nombre}`;
        return false;
    }

    mostrarToast('🍀 ¡Gato de la Suerte! Elige una de las 3 mejores perks, sin tiempo', 'success');
    ronda.nota = 'ronda de la suerte';
    return true;
}

async function elegir(indice, porTiempo = false) {
    if (!eligiendo || indice >= par.length) return;
    eligiendo = false;
    cancelAnimationFrame(timerId);
    mesa.classList.remove('gato-enojado');

    const perk = par[indice];
    const cartas = [...mesa.querySelectorAll('.carta')];
    cartas.forEach(c => { c.disabled = true; });
    const ronda = { elegida: perk, otras: par.filter((_, i) => i !== indice), suerte: rondaSuerte };
    historial.push(ronda);

    // Primero se voltea la elegida y luego las otras, para ver lo que te perdiste
    cartas[indice].classList.add('elegida', 'volteada');
    if (!rondaSuerte) playFlip();
    await delay(700);

    let siguienteSuerte = false;
    if (perk.comodin) {
        siguienteSuerte = usarComodin(ronda);
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

    if (siguienteSuerte) return nuevaRonda(true);
    if (build.length >= TAMANO_BUILD) return mostrarResumen();
    nuevaRonda();
}

function mostrarResumen() {
    const filas = historial.map(({ elegida, otras, nota, suerte }, i) => `
        <li>
            <span class="ronda">${i + 1}</span>
            <span class="ganada">✅ ${elegida.comodin || suerte ? '🍀 ' : ''}${elegida.castigo ? '😈 ' : ''}${elegida.nombre}${nota ? ` <em>(${nota})</em>` : ''}</span>
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
