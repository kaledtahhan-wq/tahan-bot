// Redirects the real Telegram client to the mock, so tests can import
// ../bot.js straight from the repo — no copying, no source patching.
const MOCK = new URL('./mock-tg.mjs', import.meta.url).href;

export async function resolve(specifier, context, next) {
  if (specifier === 'node-telegram-bot-api') {
    return { url: MOCK, shortCircuit: true };
  }
  return next(specifier, context);
}
