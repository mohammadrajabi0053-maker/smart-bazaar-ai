// مرکز بررسی سه فاز — رندر کارت فازها، آمار و گزارش آزمایش‌ها
import { LANGS, getLang, setLang, applyDir, t, label, fillLangSelect, esc } from './phases-i18n.js';

const $ = (sel, root = document) => root.querySelector(sel);
let data = null;

function badge(status) {
  return `<span class="rv-pill rv-pill--${esc(status)}">${esc(t(`status_${status}`))}</span>`;
}

function applyStatic() {
  document.title = `${t('brand')} | بازار هوشمند`;
  document.querySelectorAll('[data-rv]').forEach((el) => {
    el.textContent = t(el.dataset.rv);
  });
}

function featureRow(feature) {
  const note = feature.note ? `<p class="rv-feat__note">${esc(label(feature.note))}</p>` : '';
  const link = feature.href
    ? `<a class="rv-feat__link" href="${esc(feature.href)}">${esc(t('go_section'))} ↗</a>`
    : '';
  return `<li class="rv-feat">
    <div class="rv-feat__row"><span class="rv-feat__title">${esc(label(feature.title))}</span>${badge(feature.status)}</div>
    ${note}${link}
  </li>`;
}

function testRow(test) {
  return `<li class="rv-test">
    <span class="rv-dot rv-dot--${esc(test.status)}"></span>
    <b>${esc(label(test.label))}</b>
    <span>— ${esc(label(test.detail))}</span>
  </li>`;
}

function renderSummary() {
  const features = data.phases.flatMap((phase) => phase.features);
  const counts = features.reduce((acc, f) => {
    acc[f.status] = (acc[f.status] || 0) + 1;
    return acc;
  }, { done: 0, partial: 0, connect: 0 });

  const cells = [
    [data.phases.length, t('stat_phases')],
    [features.length, t('stat_features')],
    [counts.done || 0, t('stat_done')],
    [counts.partial || 0, t('stat_partial')],
    [counts.connect || 0, t('stat_connect')],
  ];
  $('#summary').innerHTML = cells
    .map(([value, text]) => `<div class="rv-stat"><b>${esc(value)}</b><span>${esc(text)}</span></div>`)
    .join('');
}

function renderDemoNote() {
  const mode = data.dataMode || {};
  $('#demoNote').innerHTML = `<span aria-hidden="true">ℹ️</span>
    <div><b>${esc(t('data_mode'))}:</b> ${esc(mode.demo || 0)} ${esc(t('demo_data'))} · ${esc(mode.live || 0)} ${esc(t('live_data'))}
    — ${esc(label(mode.note))}</div>`;
}

function phaseCard(phase) {
  const tests = phase.tests || [];
  const passed = tests.filter((x) => x.status === 'passed').length;
  const partial = tests.filter((x) => x.status === 'partial').length;
  const blocked = tests.filter((x) => x.status === 'blocked').length;

  return `<article class="rv-phase">
    <div class="rv-phase__head">
      <h2 class="rv-phase__title"><span class="rv-phase__num">${esc(phase.id)}</span>${esc(label(phase.title))}</h2>
      <p class="rv-phase__tag">${esc(label(phase.tagline))}</p>
    </div>
    <div class="rv-phase__body">
      <div class="rv-mini">
        <span class="rv-pill rv-pill--done">${esc(phase.counts.done)} ${esc(t('status_done'))}</span>
        <span class="rv-pill rv-pill--partial">${esc(phase.counts.partial)} ${esc(t('status_partial'))}</span>
        <span class="rv-pill rv-pill--connect">${esc(phase.counts.connect)} ${esc(t('status_connect'))}</span>
      </div>
      <h3 class="rv-h3">${esc(t('features_title'))}</h3>
      <ul class="rv-feats">${phase.features.map(featureRow).join('')}</ul>
      <h3 class="rv-h3">${esc(t('tests_title'))}</h3>
      <p class="rv-tests-sum">${esc(passed)} ${esc(t('test_ok'))} · ${esc(partial)} ${esc(t('test_warn'))} · ${esc(blocked)} ${esc(t('test_block'))}</p>
      <ul class="rv-tests">${tests.map(testRow).join('')}</ul>
    </div>
    <div class="rv-phase__foot">
      <a class="rv-btn rv-btn--primary" href="/phases/${esc(phase.id)}">${esc(t('view_phase'))} →</a>
      <a class="rv-btn rv-btn--ghost" href="/">${esc(t('back_store'))}</a>
    </div>
  </article>`;
}

function render() {
  applyStatic();
  renderSummary();
  renderDemoNote();
  $('#grid').innerHTML = data.phases.map(phaseCard).join('');
  $('#foot').innerHTML = `${esc(t('no_payment'))} — <a href="/">${esc(t('back_store'))}</a>`;
}

async function boot() {
  applyDir();
  fillLangSelect($('#langSelect'));
  applyStatic();

  $('#langSelect').addEventListener('change', (event) => {
    setLang(event.target.value);
    applyDir();
    if (data) render();
    else applyStatic();
  });

  try {
    const res = await fetch('/api/phases', { headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    data = await res.json();
    render();
  } catch (error) {
    $('#grid').innerHTML = `<div class="rv-error">${esc(t('load_error'))} (${esc(error.message)})</div>`;
  }
}

boot();
