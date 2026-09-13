'use strict';
/* Password hashing (scrypt) + session tokens + cookie parsing — node:crypto only. */
const crypto = require('node:crypto');

function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(pw), salt, 64);
  return 'scrypt$' + salt.toString('hex') + '$' + hash.toString('hex');
}
function verifyPassword(pw, stored) {
  try {
    const parts = String(stored).split('$');
    if (parts[0] !== 'scrypt') return false;
    const salt = Buffer.from(parts[1], 'hex');
    const expected = Buffer.from(parts[2], 'hex');
    const actual = crypto.scryptSync(String(pw), salt, expected.length);
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  } catch (e) { return false; }
}
function randomToken() { return crypto.randomBytes(24).toString('hex'); }

function parseCookies(header) {
  const out = {};
  (header || '').split(';').forEach((c) => {
    const i = c.indexOf('='); if (i < 0) return;
    out[c.slice(0, i).trim()] = decodeURIComponent(c.slice(i + 1).trim());
  });
  return out;
}
const SESSION_COOKIE = 'lah_sid';
const SESSION_DAYS = 30;
function sessionCookie(token) {
  return SESSION_COOKIE + '=' + token + '; Path=/; HttpOnly; SameSite=Lax; Max-Age=' + (SESSION_DAYS * 86400);
}
function clearCookie() { return SESSION_COOKIE + '=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0'; }

module.exports = { hashPassword, verifyPassword, randomToken, parseCookies, sessionCookie, clearCookie, SESSION_COOKIE, SESSION_DAYS };
