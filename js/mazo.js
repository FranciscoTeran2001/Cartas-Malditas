// ─── Lógica del mazo (sin DOM, se puede probar con node) ─────────────────────

// Probabilidad de que cada carta del par sea de agotamiento
export const PROB_AGOTAMIENTO = 0.25;
// Probabilidad de que "Me la pela" esté en un par. Las cartas van boca abajo, así que
// te toca la mitad de las veces que está (o siempre si se acaba el tiempo): ~1 de cada 5 builds
export const PROB_CASTIGO = 0.1;

// Fisher-Yates: reparto justo
function barajar(lista) {
    for (let i = lista.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [lista[i], lista[j]] = [lista[j], lista[i]];
    }
    return lista;
}

export async function cargarPerks() {
    const response = await fetch('perks.json');
    if (!response.ok) throw new Error('No se pudo cargar perks.json');
    return response.json();
}

// Probabilidad de que el comodín esté en un par (una vez por build; a ciegas te toca ~3% por ronda)
export const PROB_COMODIN = 0.06;
// "El gato se apiada": con "Me la pela" en la build el comodín sale mucho más
export const PROB_COMODIN_CON_CASTIGO = 0.5; // ~1 de cada 3 castigados se salva
export const COMODIN = { id: 'comodin', nombre: 'Gato de la Suerte', superviviente: 'Comodín', comodin: true };

// Saca 2 cartas distintas que no estén ya en la build
export function sacarCartas(perks, build, { comodinUsado = false } = {}) {
    const disponibles = perks.filter(p => !build.some(b => b.id === p.id));
    // Con una de agotamiento o con "Me la pela" en la build, el agotamiento ya no sirve
    const sinAgotamiento = build.some(p => p.agotamiento || p.castigo);
    const agotamiento = barajar(disponibles.filter(p => p.agotamiento));
    const castigo = disponibles.filter(p => p.castigo);
    const normales = barajar(disponibles.filter(p => !p.agotamiento && !p.castigo));

    const mano = [];
    if (castigo.length && Math.random() < PROB_CASTIGO) mano.push(castigo[0]);
    const probComodin = build.some(p => p.castigo) ? PROB_COMODIN_CON_CASTIGO : PROB_COMODIN;
    if (!comodinUsado && Math.random() < probComodin) mano.push(COMODIN);
    while (mano.length < 2) {
        const usarAgotamiento = !sinAgotamiento && agotamiento.length
            && !mano.some(p => p.agotamiento) && Math.random() < PROB_AGOTAMIENTO;
        mano.push(usarAgotamiento ? agotamiento.pop() : normales.pop());
    }
    return barajar(mano);
}

// Ronda de la suerte: 3 perks "mejor" (meta) al azar que respeten las reglas de la build
export function perksDeLaSuerte(perks, build, cantidad = 3) {
    const sinAgotamiento = build.some(p => p.agotamiento || p.castigo);
    const candidatas = perks.filter(p => p.mejor
        && !build.some(b => b.id === p.id)
        && !(sinAgotamiento && p.agotamiento));
    return barajar(candidatas).slice(0, cantidad);
}

// Si se acaba el tiempo: el gato se impacienta y te da el castigo si está; si no, una al azar
export function elegirPorTiempo(par) {
    const castigo = par.findIndex(p => p.castigo);
    return castigo !== -1 ? castigo : Math.floor(Math.random() * par.length);
}
