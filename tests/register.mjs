//Registers the Telegram mock loader. Activated via:
//   node --import ./tests/register.mjs tests/run.mjs
import { register } from 'node:module';

register('./loader.mjs', import.meta.url);
