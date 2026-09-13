'use strict';
/* PayTabs Hosted Payment Page (Egypt by default).
   Live when PAYTABS_PROFILE_ID + PAYTABS_SERVER_KEY are set in the environment;
   otherwise a built-in mock lets the whole checkout flow work end-to-end offline. */

const REGIONS = {
  egypt: 'https://secure-egypt.paytabs.com',
  global: 'https://secure-global.paytabs.com',
  ksa: 'https://secure.paytabs.sa',
  uae: 'https://secure.paytabs.com',
  jordan: 'https://secure-jordan.paytabs.com',
  oman: 'https://secure-oman.paytabs.com'
};
const HOST = REGIONS[(process.env.PAYTABS_REGION || 'egypt').toLowerCase()] || REGIONS.egypt;
const PROFILE_ID = process.env.PAYTABS_PROFILE_ID || '';
const SERVER_KEY = process.env.PAYTABS_SERVER_KEY || '';

function configured() { return !!(PROFILE_ID && SERVER_KEY); }

async function ptPost(pathname, body) {
  const res = await fetch(HOST + pathname, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: SERVER_KEY },
    body: JSON.stringify(body)
  });
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch (e) { data = { raw: text }; }
  if (!res.ok) throw new Error('PayTabs ' + res.status + ': ' + (data.message || text));
  return data;
}

/* Create a hosted payment page for an order. Returns { redirect_url, tran_ref, mock }. */
async function createPayment(order, baseUrl) {
  if (!configured()) {
    return { redirect_url: baseUrl + '/pay-mock.html?order=' + encodeURIComponent(order.id), tran_ref: null, mock: true };
  }
  const data = await ptPost('/payment/request', {
    profile_id: Number(PROFILE_ID),
    tran_type: 'sale',
    tran_class: 'ecom',
    cart_id: order.id,
    cart_currency: 'EGP',
    cart_amount: order.total,
    cart_description: 'Lahmetna order ' + order.id,
    customer_details: {
      name: order.name || 'Customer',
      email: order.email || 'customer@lahmetna.com',
      phone: order.phone || '',
      street1: order.address || 'N/A',
      city: 'Cairo', country: 'EG', zip: '00000'
    },
    callback: baseUrl + '/api/paytabs/callback',
    return: baseUrl + '/api/paytabs/return',
    hide_shipping: true
  });
  return { redirect_url: data.redirect_url, tran_ref: data.tran_ref, mock: false };
}

/* Verify a transaction server-side rather than trusting a callback body. */
async function verify(tran_ref) {
  if (!configured()) return { paid: true, ref: tran_ref || 'MOCK' }; // mock: treated as paid by the mock page
  const data = await ptPost('/payment/query', { profile_id: Number(PROFILE_ID), tran_ref });
  const status = data.payment_result && data.payment_result.response_status;
  return { paid: status === 'A', ref: tran_ref, cart_id: data.cart_id, status };
}

module.exports = { configured, createPayment, verify, HOST };
