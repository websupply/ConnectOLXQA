const fs = require('fs');
const path = require('path');

const reportPath = path.join(process.cwd(), 'reports', 'newman-report.json');
const historyPrevPath = path.join(process.cwd(), 'reports', 'history-prev.json');
const publicDir = path.join(process.cwd(), 'public');
fs.mkdirSync(publicDir, { recursive: true });

let summary = null;
let executions = [];
let failures = [];
let collectionName = '[QA] Testes - OLX';

if (fs.existsSync(reportPath)) {
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  summary = report.run?.stats || {};
  executions = report.run?.executions || [];
  failures = report.run?.failures || [];
  collectionName = report.collection?.name || collectionName;
}

const stats = {
  requestsTotal: summary?.requests?.total || 0,
  requestsFailed: summary?.requests?.failed || 0,
  assertionsTotal: summary?.assertions?.total || 0,
  assertionsFailed: summary?.assertions?.failed || 0,
  testsTotal: summary?.tests?.total || 0,
  testsFailed: summary?.tests?.failed || 0,
  timestamp: new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
};

const assertionsPassed = stats.assertionsTotal - stats.assertionsFailed;
const successRate = stats.assertionsTotal > 0
  ? Math.round((assertionsPassed / stats.assertionsTotal) * 100)
  : 0;

const overallStatus = failures.length === 0
  ? { label: 'Todos os testes passaram', tone: 'ok' }
  : { label: `${failures.length} ${failures.length === 1 ? 'falha encontrada' : 'falhas encontradas'}`, tone: 'bad' };

// Anel de progresso (SVG) para a taxa de sucesso
const RADIUS = 54;
const CIRC = 2 * Math.PI * RADIUS;
const ringOffset = CIRC - (successRate / 100) * CIRC;
const ringTone = successRate === 100 ? 'ok' : successRate >= 80 ? 'warn' : 'bad';

const avgResponseTime = executions.length
  ? Math.round(executions.reduce((sum, e) => sum + (e.response?.responseTime || 0), 0) / executions.length)
  : 0;

// Historico de execucoes: le o historico anterior (baixado do gh-pages antes deste
// script rodar) e acrescenta a execucao atual, mantendo um limite de registros.
let history = [];
if (fs.existsSync(historyPrevPath)) {
  try {
    const parsedHistory = JSON.parse(fs.readFileSync(historyPrevPath, 'utf8'));
    if (Array.isArray(parsedHistory)) history = parsedHistory;
  } catch (e) {
    history = [];
  }
}

const MAX_HISTORY = 20;
history.push({
  timestamp: stats.timestamp,
  successRate,
  requestsTotal: stats.requestsTotal,
  requestsFailed: stats.requestsFailed,
  assertionsTotal: stats.assertionsTotal,
  assertionsFailed: stats.assertionsFailed,
  failuresCount: failures.length,
  status: failures.length ? 'failed' : 'ok',
  runUrl: process.env.RUN_URL || null
});
if (history.length > MAX_HISTORY) {
  history = history.slice(history.length - MAX_HISTORY);
}

const historyRows = [...history].reverse().map((entry) => {
  const rateTone = entry.successRate === 100 ? 'ok' : entry.successRate >= 80 ? 'warn' : 'bad';
  const badgeClass = entry.status === 'ok' ? 'passed' : 'failed';
  const badgeText = entry.status === 'ok' ? 'OK' : 'Falhou';
  const link = entry.runUrl
    ? `<a href="${escapeHtml(entry.runUrl)}" target="_blank" rel="noopener">ver execucao</a>`
    : '<span class="cell-muted">-</span>';
  return `<tr>
    <td class="cell-muted">${escapeHtml(entry.timestamp)}</td>
    <td><strong class="status-code ${rateTone}">${entry.successRate}%</strong></td>
    <td class="cell-muted">${entry.requestsTotal}</td>
    <td class="cell-muted">${entry.assertionsFailed}</td>
    <td><span class="badge ${badgeClass}"><i class="dot"></i>${badgeText}</span></td>
    <td>${link}</td>
  </tr>`;
}).join('\n');

const rows = executions.map((execution) => {
  const itemName = execution.item?.name || 'Sem nome';
  const method = execution.request?.method || '-';
  const status = execution.response?.code ?? '-';
  const responseTime = execution.response?.responseTime ?? '-';
  const failedAssertions = failures.filter(f => f.source?.name === itemName);
  const resultClass = failedAssertions.length ? 'failed' : 'passed';
  const resultText = failedAssertions.length ? 'Falhou' : 'Passou';
  const statusClass = String(status).startsWith('2') ? 'ok' : String(status).startsWith('4') || String(status).startsWith('5') ? 'bad' : 'muted';
  return `<tr>
    <td class="cell-main">${escapeHtml(itemName)}</td>
    <td><span class="method method-${escapeHtml(method).toLowerCase()}">${escapeHtml(method)}</span></td>
    <td><span class="status-code ${statusClass}">${status}</span></td>
    <td class="cell-muted">${responseTime !== '-' ? `${responseTime} ms` : '-'}</td>
    <td><span class="badge ${resultClass}"><i class="dot"></i>${resultText}</span></td>
  </tr>`;
}).join('\n');

const failureCards = failures.length
  ? failures.map((failure) => `<div class="failure-card">
      <div class="failure-icon">!</div>
      <div class="failure-body">
        <p class="failure-title">${escapeHtml(failure.source?.name || 'Sem nome')}</p>
        <p class="failure-test">${escapeHtml(failure.error?.test || '-')}</p>
        <p class="failure-message">${escapeHtml(failure.error?.message || '-')}</p>
      </div>
    </div>`).join('\n')
  : `<div class="empty-state">
      <div class="empty-icon">OK</div>
      <p>Nenhuma falha encontrada nesta execucao.</p>
    </div>`;

const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Dashboard QA - OLX</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  :root {
    --bg-0: #0b0f1a;
    --bg-1: #0f1524;
    --card: #131a2b;
    --card-border: #232c42;
    --text: #eef1f8;
    --muted: #8b93a7;
    --ok: #34d399;
    --ok-soft: rgba(52, 211, 153, .14);
    --bad: #f87171;
    --bad-soft: rgba(248, 113, 113, .14);
    --warn: #fbbf24;
    --warn-soft: rgba(251, 191, 36, .14);
    --accent: #6366f1;
    --accent-soft: rgba(99, 102, 241, .16);
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: 'Inter', -apple-system, sans-serif;
    color: var(--text);
    background:
      radial-gradient(1100px 500px at 15% -10%, rgba(99,102,241,.20), transparent),
      radial-gradient(900px 500px at 100% 0%, rgba(52,211,153,.10), transparent),
      var(--bg-0);
    min-height: 100vh;
  }
  .wrap { max-width: 1180px; margin: 0 auto; padding: 40px 24px 64px; }

  header.top {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding-bottom: 28px;
    border-bottom: 1px solid var(--card-border);
    margin-bottom: 32px;
  }
  .brand { display: flex; align-items: center; gap: 14px; }
  .brand-mark {
    width: 44px; height: 44px; border-radius: 12px;
    background: linear-gradient(135deg, var(--accent), #8b5cf6);
    display: flex; align-items: center; justify-content: center;
    font-weight: 800; font-size: 18px; color: white;
    box-shadow: 0 8px 20px rgba(99,102,241,.35);
  }
  .brand h1 { margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -.02em; }
  .brand p { margin: 2px 0 0; color: var(--muted); font-size: 13px; }
  .status-chip {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 9px 16px; border-radius: 999px; font-size: 13px; font-weight: 600;
  }
  .status-chip.ok { background: var(--ok-soft); color: var(--ok); }
  .status-chip.bad { background: var(--bad-soft); color: var(--bad); }
  .status-chip i.dot { width: 8px; height: 8px; border-radius: 50%; background: currentColor; display: inline-block; }

  .hero {
    display: grid;
    grid-template-columns: 220px 1fr;
    gap: 28px;
    background: var(--card);
    border: 1px solid var(--card-border);
    border-radius: 20px;
    padding: 28px;
    margin-bottom: 24px;
  }
  .ring-block { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; }
  .ring-wrap { position: relative; width: 132px; height: 132px; }
  .ring-wrap svg { transform: rotate(-90deg); }
  .ring-value {
    position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
    flex-direction: column;
  }
  .ring-value strong { font-size: 28px; font-weight: 800; }
  .ring-value span { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: .06em; }
  .ring-label { font-size: 13px; color: var(--muted); font-weight: 500; }

  .metrics-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 16px;
  }
  .metric {
    border: 1px solid var(--card-border);
    border-radius: 14px;
    padding: 16px 18px;
    background: rgba(255,255,255,.015);
  }
  .metric .icon {
    width: 30px; height: 30px; border-radius: 9px;
    display: flex; align-items: center; justify-content: center;
    font-size: 14px; font-weight: 700; margin-bottom: 10px;
  }
  .metric.blue .icon { background: var(--accent-soft); color: var(--accent); }
  .metric.green .icon { background: var(--ok-soft); color: var(--ok); }
  .metric.amber .icon { background: var(--warn-soft); color: var(--warn); }
  .metric.red .icon { background: var(--bad-soft); color: var(--bad); }
  .metric span.label { display: block; color: var(--muted); font-size: 12.5px; margin-bottom: 4px; }
  .metric strong { font-size: 24px; font-weight: 800; }

  section.panel {
    background: var(--card);
    border: 1px solid var(--card-border);
    border-radius: 20px;
    padding: 26px 26px 10px;
    margin-bottom: 24px;
  }
  section.panel h2 {
    margin: 0 0 4px;
    font-size: 17px;
    font-weight: 700;
    display: flex; align-items: center; gap: 8px;
  }
  section.panel .subtitle { color: var(--muted); font-size: 13px; margin: 0 0 18px; }

  table { width: 100%; border-collapse: collapse; }
  thead th {
    text-align: left; font-size: 11.5px; text-transform: uppercase; letter-spacing: .05em;
    color: var(--muted); font-weight: 600; padding: 0 14px 12px; border-bottom: 1px solid var(--card-border);
  }
  tbody td { padding: 14px; border-bottom: 1px solid var(--card-border); font-size: 13.5px; }
  tbody tr:last-child td { border-bottom: none; }
  tbody tr:hover { background: rgba(255,255,255,.02); }
  .cell-main { font-weight: 600; }
  .cell-muted { color: var(--muted); }

  .method {
    font-size: 11px; font-weight: 700; padding: 4px 9px; border-radius: 6px;
    background: rgba(255,255,255,.06); letter-spacing: .03em;
  }
  .method-get { color: #60a5fa; } .method-post { color: #34d399; }
  .method-put, .method-patch { color: #fbbf24; } .method-delete { color: #f87171; }

  .status-code { font-weight: 700; font-variant-numeric: tabular-nums; }
  .status-code.ok { color: var(--ok); }
  .status-code.bad { color: var(--bad); }
  .status-code.warn { color: var(--warn); }
  .status-code.muted { color: var(--muted); }

  .badge {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 5px 11px; border-radius: 999px; font-weight: 700; font-size: 11.5px;
  }
  .badge.passed { background: var(--ok-soft); color: var(--ok); }
  .badge.failed { background: var(--bad-soft); color: var(--bad); }
  .badge i.dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; display: inline-block; }

  .failure-card {
    display: flex; gap: 14px;
    padding: 16px; border-radius: 14px;
    background: var(--bad-soft);
    border: 1px solid rgba(248,113,113,.25);
    margin-bottom: 14px;
  }
  .failure-icon {
    flex-shrink: 0; width: 28px; height: 28px; border-radius: 8px;
    background: var(--bad); color: #1a0a0a; font-weight: 800;
    display: flex; align-items: center; justify-content: center;
  }
  .failure-title { margin: 0 0 3px; font-weight: 700; font-size: 14px; }
  .failure-test { margin: 0 0 4px; font-size: 12.5px; color: var(--bad); font-weight: 600; }
  .failure-message { margin: 0; font-size: 13px; color: var(--muted); }

  .empty-state {
    display: flex; flex-direction: column; align-items: center; gap: 10px;
    padding: 40px 0; color: var(--muted);
  }
  .empty-icon {
    width: 44px; height: 44px; border-radius: 50%;
    background: var(--ok-soft); color: var(--ok);
    display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 800;
  }

  footer {
    text-align: center; color: var(--muted); font-size: 12.5px;
    padding-top: 12px; padding-bottom: 24px;
  }
  a { color: var(--accent); text-decoration: none; }
  a:hover { text-decoration: underline; }
  footer a { font-weight: 600; }

  @media (max-width: 720px) {
    .hero { grid-template-columns: 1fr; }
    table { display: block; overflow-x: auto; }
  }
</style>
</head>
<body>
  <div class="wrap">
    <header class="top">
      <div class="brand">
        <div class="brand-mark">QA</div>
        <div>
          <h1>Dashboard de Qualidade - OLX</h1>
          <p>${escapeHtml(collectionName)} &nbsp;&middot;&nbsp; atualizado em ${stats.timestamp}</p>
        </div>
      </div>
      <span class="status-chip ${overallStatus.tone}"><i class="dot"></i>${overallStatus.label}</span>
    </header>

    <div class="hero">
      <div class="ring-block">
        <div class="ring-wrap">
          <svg width="132" height="132" viewBox="0 0 132 132">
            <circle cx="66" cy="66" r="${RADIUS}" fill="none" stroke="var(--card-border)" stroke-width="12" />
            <circle cx="66" cy="66" r="${RADIUS}" fill="none" stroke="var(--${ringTone})" stroke-width="12"
              stroke-linecap="round" stroke-dasharray="${CIRC}" stroke-dashoffset="${ringOffset}" />
          </svg>
          <div class="ring-value">
            <strong>${successRate}%</strong>
            <span>sucesso</span>
          </div>
        </div>
        <p class="ring-label">Taxa de assertions aprovadas</p>
      </div>

      <div class="metrics-grid">
        <div class="metric blue">
          <div class="icon">&#8635;</div>
          <span class="label">Requests executadas</span>
          <strong>${stats.requestsTotal}</strong>
        </div>
        <div class="metric ${stats.requestsFailed ? 'red' : 'green'}">
          <div class="icon">${stats.requestsFailed ? '&times;' : '&#10003;'}</div>
          <span class="label">Requests com falha</span>
          <strong>${stats.requestsFailed}</strong>
        </div>
        <div class="metric blue">
          <div class="icon">&Sigma;</div>
          <span class="label">Assertions</span>
          <strong>${stats.assertionsTotal}</strong>
        </div>
        <div class="metric ${stats.assertionsFailed ? 'red' : 'green'}">
          <div class="icon">${stats.assertionsFailed ? '&times;' : '&#10003;'}</div>
          <span class="label">Assertions falhas</span>
          <strong>${stats.assertionsFailed}</strong>
        </div>
        <div class="metric amber">
          <div class="icon">&#9201;</div>
          <span class="label">Tempo medio</span>
          <strong>${avgResponseTime} ms</strong>
        </div>
      </div>
    </div>

    <section class="panel">
      <h2>Resultado por requisicao</h2>
      <p class="subtitle">${executions.length} cenario(s) executado(s) nesta rodada</p>
      <table>
        <thead>
          <tr><th>Cenario</th><th>Metodo</th><th>Status</th><th>Tempo</th><th>Resultado</th></tr>
        </thead>
        <tbody>${rows || '<tr><td colspan="5" class="cell-muted">Nenhuma execucao encontrada.</td></tr>'}</tbody>
      </table>
    </section>

    <section class="panel">
      <h2>Detalhamento de falhas</h2>
      <p class="subtitle">${failures.length} ocorrencia(s) identificada(s)</p>
      <div style="padding-bottom: 16px;">
        ${failureCards}
      </div>
    </section>

    <section class="panel">
      <h2>Historico de execucoes</h2>
      <p class="subtitle">Ultimas ${history.length} execucao(oes) registrada(s)</p>
      <table>
        <thead>
          <tr><th>Data</th><th>Taxa de sucesso</th><th>Requests</th><th>Assertions falhas</th><th>Status</th><th>Link</th></tr>
        </thead>
        <tbody>${historyRows || '<tr><td colspan="6" class="cell-muted">Nenhum historico disponivel ainda.</td></tr>'}</tbody>
      </table>
    </section>

    <footer>
      <p>Gerado automaticamente via GitHub Actions</p>
    </footer>
  </div>
</body>
</html>`;

fs.writeFileSync(path.join(publicDir, 'index.html'), html);

fs.writeFileSync(path.join(publicDir, 'history.json'), JSON.stringify(history, null, 2));

fs.writeFileSync(path.join(publicDir, '.nojekyll'), '');

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}