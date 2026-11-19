/* بازار هوشمند — منطق ورود/ثبت‌نام تلفنی با کد تأیید */
import { api } from './core.js';
import { T, mountPage, toast, industryOptions } from './p3.js';

const $ = (sel) => document.querySelector(sel);

const state = {
  mode: 'login',
  phone: '',
  sending: false,
};

const statusEl = () => $('#status');
const setStatus = (text, tone = '') => {
  const el = statusEl();
  if (!el) return;
  el.textContent = text || '';
  el.style.color = tone === 'error' ? '#b42318' : tone === 'ok' ? '#0b5a4c' : '';
};

function setMode(mode) {
  state.mode = mode;
  $('#modeLogin').setAttribute('aria-selected', String(mode === 'login'));
  $('#modeRegister').setAttribute('aria-selected', String(mode === 'register'));
  $('#registerFields').hidden = mode !== 'register';
  $('#phoneForm').hidden = false;
  $('#codeForm').hidden = true;
  setStatus('');
  syncSellerFields();
}

function syncSellerFields() {
  const isSeller = $('#role')?.value === 'seller';
  if ($('#sellerFields')) $('#sellerFields').hidden = !isSeller;
}

function nextTarget() {
  const params = new URLSearchParams(location.search);
  const next = params.get('next');
  if (next && next.startsWith('/') && !next.startsWith('//')) return next;
  return null;
}

async function loadIndustries() {
  try {
    const data = await api('/api/directory/catalog');
    const select = $('#industry');
    if (select) select.innerHTML = industryOptions(data.industries || []);
  } catch {
    /* فهرست صنوف اختیاری است؛ ثبت‌نام بدون آن هم انجام می‌شود */
  }
}

async function requestCode(event) {
  event?.preventDefault();
  if (state.sending) return;
  const phone = $('#phone').value.trim();
  if (!phone) {
    setStatus(T('required'), 'error');
    return;
  }
  const body = { phone, mode: state.mode };
  if (state.mode === 'register') {
    body.name = $('#name').value.trim();
    body.role = $('#role').value;
    if (body.role === 'seller') {
      body.storeName = $('#storeName').value.trim();
      body.industry = $('#industry').value;
      body.city = $('#city').value.trim();
    }
  }

  state.sending = true;
  $('#requestBtn').disabled = true;
  setStatus(T('loading'));
  try {
    const data = await api('/api/auth/phone/request', { method: 'POST', body });
    state.phone = data.phone;
    $('#phoneForm').hidden = true;
    $('#codeForm').hidden = false;
    const note = $('#codeNote');
    note.hidden = false;
    note.textContent = `${T('demo_code')} ${data.previewCode}`;
    note.dir = 'auto';
    $('#code').value = '';
    $('#code').focus();
    setStatus(T('code_sent'), 'ok');
  } catch (err) {
    setStatus(errorText(err.message), 'error');
  } finally {
    state.sending = false;
    $('#requestBtn').disabled = false;
  }
}

const ERRORS = {
  phone_invalid: 'شماره تلفن معتبر نیست. / Invalid phone number.',
  account_not_found: 'حسابی با این شماره نیست؛ ابتدا ثبت‌نام کنید. / No account with this number; please register.',
  phone_already_registered: 'این شماره قبلاً ثبت شده است؛ وارد شوید. / This number is already registered; sign in.',
  name_required: 'نام را کامل وارد کنید. / Please enter your full name.',
  store_name_required: 'نام کسب‌وکار الزامی است. / Business name is required.',
  otp_not_found: 'ابتدا کد تأیید بگیرید. / Request a code first.',
  otp_expired: 'کد منقضی شده؛ کد جدید بگیرید. / Code expired; request a new one.',
  otp_attempts_exceeded: 'تعداد تلاش بیش از حد؛ کد جدید بگیرید. / Too many attempts; request a new code.',
  otp_incorrect: 'کد وارد شده درست نیست. / Incorrect code.',
  otp_too_many_requests: 'درخواست بیش از حد؛ کمی بعد تلاش کنید. / Too many requests; try later.',
  otp_hourly_limit: 'سقف درخواست ساعتی پر شده است. / Hourly request limit reached.',
  account_blocked: 'این حساب مسدود است. / This account is blocked.',
};

function errorText(code) {
  return ERRORS[code] || code;
}

async function verifyCode(event) {
  event?.preventDefault();
  const code = $('#code').value.trim();
  if (!code) {
    setStatus(T('required'), 'error');
    return;
  }
  $('#verifyBtn').disabled = true;
  setStatus(T('loading'));
  try {
    const data = await api('/api/auth/phone/verify', {
      method: 'POST',
      body: { phone: state.phone, code, mode: state.mode },
    });
    toast(T('phone_verified'), 'ok');
    const target = nextTarget() || (data.user?.role === 'seller' ? '/seller' : '/account');
    location.assign(target);
  } catch (err) {
    setStatus(errorText(err.message), 'error');
    $('#verifyBtn').disabled = false;
  }
}

function init() {
  mountPage();
  loadIndustries();

  $('#modeLogin').addEventListener('click', () => setMode('login'));
  $('#modeRegister').addEventListener('click', () => setMode('register'));
  $('#role').addEventListener('change', syncSellerFields);
  $('#phoneForm').addEventListener('submit', requestCode);
  $('#codeForm').addEventListener('submit', verifyCode);
  $('#backBtn').addEventListener('click', () => {
    if (state.phone) {
      $('#code').value = '';
      requestCode();
    } else {
      $('#codeForm').hidden = true;
      $('#phoneForm').hidden = false;
    }
  });
  $('#editPhoneBtn').addEventListener('click', () => {
    $('#codeForm').hidden = true;
    $('#phoneForm').hidden = false;
    $('#phone').focus();
    setStatus('');
  });
  window.addEventListener('lang-changed', () => {
    mountPage();
    loadIndustries();
  });

  const params = new URLSearchParams(location.search);
  if (params.get('mode') === 'register') setMode('register');
}

init();
