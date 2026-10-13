// Registra os ganchos de resolucao antes de o teste carregar a ponte.
// Uso: node --import ./registrar-resolucao.mjs ponte-real.test.mjs
import { register } from 'node:module';
register('./ganchos-resolucao.mjs', import.meta.url);
