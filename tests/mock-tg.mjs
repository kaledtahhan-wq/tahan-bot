// بديل node-telegram-bot-api ليشتغل البوت بلا شبكة
//
// Faithful to the real API where it matters:
//  - sendMessage / editMessageText reject text over 4096 chars (like Telegram)
//  - a malformed inline_keyboard is recorded in `kbProblems` instead of being
//    silently accepted. Telegram would reject the WHOLE message, so we collect
//    the problems and let the suite assert the list is empty.
export const sent = [];
export const polls = [];
/** @type {string[]} */
export const kbProblems = [];

let failSend = false;

const KB_LIMIT = 64; // حد callback_data بالبايت في تيليغرام

function checkKeyboard(where, opt) {
  const kb = opt && (opt.reply_markup || opt);
  const rows = kb && kb.inline_keyboard;
  if (!rows) return;
  if (!Array.isArray(rows)) {
    kbProblems.push(`${where}: inline_keyboard ليس مصفوفة`);
    return;
  }
  rows.forEach((row, ri) => {
    if (!Array.isArray(row)) {
      kbProblems.push(`${where} صف ${ri}: ليس مصفوفة`);
      return;
    }
    row.forEach((btn, bi) => {
      const at = `${where} صف ${ri} زر ${bi}`;
      if (Array.isArray(btn)) return kbProblems.push(`${at}: مصفوفة داخل مصفوفة (صف غير مسطّح)`);
      if (!btn || typeof btn !== 'object') return kbProblems.push(`${at}: ليس كائن زر`);
      if (!btn.text) return kbProblems.push(`${at}: لا يوجد text`);
      if (!btn.url && !btn.callback_data && !btn.web_app) return kbProblems.push(`${at}: لا url ولا callback_data ولا web_app`);
      if (btn.callback_data != null) {
        const n = Buffer.byteLength(String(btn.callback_data), 'utf8');
        if (n > KB_LIMIT) kbProblems.push(`${at}: callback_data ${n} بايت > ${KB_LIMIT}`);
      }
    });
  });
}

class MockBot {
  constructor(token, opts) { this.token = token; this.opts = opts; this._h = {}; }
  on(ev, cb) { (this._h[ev] ||= []).push(cb); return this; }
  onText(re, cb) { (this._h.text ||= []).push({ re, cb }); return this; }
  async sendMessage(chatId, text, opt) {
    if (failSend) { const e = new Error('simulated send failure'); e.response = { body: { error_code: 400 } }; throw e; }
    const t = String(text);
    if (t.length > 4096) console.log('  !! OVER-4096:', t.length, JSON.stringify(t.slice(0, 40)));
    checkKeyboard('sendMessage', opt);
    sent.push({ kind: 'send', chatId, text: t, opt });
    return { message_id: sent.length };
  }
  async editMessageText(text, opt) {
    if (failSend) { const e = new Error('simulated edit failure'); e.response = { body: { error_code: 400 } }; throw e; }
    const t = String(text);
    if (t.length > 4096) console.log('  !! OVER-4096:', t.length, JSON.stringify(t.slice(0, 40)));
    checkKeyboard('editMessageText', opt);
    sent.push({ kind: 'edit', msgId: opt.message_id, text: t, opt });
    return true;
  }
  async sendPhoto(c, p, o) { sent.push({ kind: 'photo', chatId: c, opt: o }); return true; }
  async answerCallbackQuery(id, o) { polls.push(['answerCb', o]); return true; }
  async setWebHook(u) { polls.push(['setWebHook', u]); return true; }
  startPolling() { polls.push(['startPolling']); return new Promise(() => {}); }
  stopPolling() {}
  processUpdate() {}
  __fail(v) { failSend = v; }
  __handlers() { return this._h; }
}

export default MockBot;
