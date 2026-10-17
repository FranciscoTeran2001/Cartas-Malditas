// Prueba rápida de la lógica del mazo: node js/mazo.test.mjs
import assert from 'node:assert';
import fs from 'node:fs';
import { sacarCartas, elegirPorTiempo } from './mazo.js';
const sacarPar = (perks, build) => sacarCartas(perks, build);

const perks = JSON.parse(fs.readFileSync(new URL('../perks.json', import.meta.url), 'utf8'));
const fajador = perks.find(p => p.id === 31);
const meLaPela = perks.find(p => p.castigo);
const normal = perks.find(p => !p.agotamiento && !p.castigo);

let paresConCastigo = 0;
for (let k = 0; k < 5000; k++) {
    const par = sacarPar(perks, [normal]);
    assert.strictEqual(par.length, 2);
    assert.notStrictEqual(par[0].id, par[1].id, 'cartas repetidas');
    assert.ok(!par.some(p => p.id === normal.id), 'salió una perk de la build');
    assert.ok(par.filter(p => p.agotamiento).length <= 1, 'dos de agotamiento');
    if (par.some(p => p.castigo)) paresConCastigo++;

    for (const build of [[fajador], [meLaPela]]) {
        const par2 = sacarPar(perks, build);
        assert.ok(!par2.some(p => p.agotamiento), 'agotamiento con build que lo bloquea');
    }
}
// Ronda de la suerte: 3 cartas, sin castigo ni comodín; con comodín usado no vuelve a salir
for (let k = 0; k < 2000; k++) {
    const trio = sacarCartas(perks, [meLaPela], { cantidad: 3, suerte: true });
    assert.strictEqual(new Set(trio.map(p => p.id)).size, 3);
    assert.ok(!trio.some(p => p.castigo || p.comodin), 'castigo o comodín en ronda de la suerte');
    assert.ok(!sacarCartas(perks, [], { comodinUsado: true }).some(p => p.comodin), 'comodín repetido');
}

assert.strictEqual(elegirPorTiempo([normal, meLaPela]), 1, 'al acabarse el tiempo debe tocar el castigo');
console.log(`ok · pares con castigo: ${(100 * paresConCastigo / 5000).toFixed(1)}%`);
