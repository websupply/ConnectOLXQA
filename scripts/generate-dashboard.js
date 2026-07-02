const fs = require('fs');
const path = require('path');

const reportPath = path.join(process.cwd(), 'reports', 'newman-report.json');
const publicDir = path.join(process.cwd(), 'public');
const historyDir = path.join(publicDir, 'history');
fs.mkdirSync(publicDir, { recursive: true });
fs.mkdirSync(historyDir, { recursive: true });

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
  requestsTotal: summary.requests?.total || 0,
  requestsFailed: summary.requests?.failed || 0,
  assertionsTotal: summary.assertions?.total || 0,
  assertionsFailed: summary.assertions?.failed || 0,
  testsTotal: summary.tests?.total || 0,
  testsFailed: summary.tests?.failed || 0,
  timestamp: new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
};

const successRate = stats.assertionsTotal > 0
  ? Math.round(((stats.assertionsTotal - stats.assertionsFailed) / stats.assertionsTotal) * 100)
  : 0;

const rows = executions.map((execution) => {
  const itemName = execution.item?.name || 'Sem nome';
  const method = execution.request?.method || '-';
  const status = execution.response?.code || '-';
  const responseTime = execution.response?.responseTime || '-';
  const failedAssertions = failures.filter(f => f.source?.name === itemName);
  const resultClass = failedAssertions.length ? 'failed' : 'passed';
  const resultText = failedAssertions.length ? 'Falhou' : 'Passou';
  return `<tr>
    <td>${escapeHtml(itemName)}</td>
    <td>${escapeHtml(method)}</td>
    <td>${status}</td>
    <td>${responseTime} ms</td>
    <td><span class="badge ${resultClass}">${resultText}</span></td>
  </tr>`;
}).join('\n');

const failureRows = failures.length
  ? failures.map((failure) => `<tr>
      <td>${escapeHtml(failure.source?.name || 'Sem nome')}</td>
      <td>${escapeHtml(failure.error?.test || '-')}</td>
      <td>${escapeHtml(failure.error?.message || '-')}</td>
    </tr>`).join('\n')
  : `<tr><td colspan="3">Nenhuma falha encontrada.</td></tr>`;

const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Dashboard QA - OLX</title>
  <style>
    :root { --bg: #0f172a; --card: #111827; --text: #e5e7eb; --muted: #94a3b8; --ok: #22c55e; --bad: #ef4444; --warn: #f59e0b; --line: #1f2937; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Arial, sans-serif; background: var(--bg); color: var(--text); }
    header { padding: 32px; border-bottom: 1px solid var(--line); }
    header h1 { margin: 0 0 8px; font-size: 30px; }
    header p { margin: 0; color: var(--muted); }
    main { padding: 32px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 16px; margin-bottom: 28px; }
    .card { background: var(--card); border: 1px solid var(--line); border-radius: 14px; padding: 20px; }
    .card span { color: var(--muted); font-size: 13px; }
    .card strong { display: block; margin-top: 10px; font-size: 30px; }
    .ok { color: var(--ok); } .bad { color: var(--bad); } .warn { color: var(--warn); }
    section { margin-top: 24px; }
    h2 { margin: 0 0 14px; font-size: 22px; }
    table { width: 100%; border-collapse: collapse; overflow: hidden; border-radius: 12px; }
    th, td { padding: 14px; border-bottom: 1px solid var(--line); text-align: left; }
    th { color: var(--muted); font-size: 13px; background: #0b1220; }
    tr { background: var(--card); }
    .badge { padding: 6px 10px; border-radius: 999px; font-weight: 700; font-size: 12px; }
    .passed { background: rgba(34, 197, 94, .15); color: var(--ok); }
    .failed { background: rgba(239, 68, 68, .15); color: var(--bad); }
    a { color: #60a5fa; }
  </style>
</head>
<body>
  <header>
    <h1>Dashboard de Qualidade - OLX</h1>
    <p>Collection: ${escapeHtml(collectionName)} | Última execução: ${stats.timestamp}</p>
  </header>
  <main>
    <div class="grid">
      <div class="card"><span>Taxa de sucesso</span><strong class="${successRate === 100 ? 'ok' : successRate >= 80 ? 'warn' : 'bad'}">${successRate}%</strong></div>
      <div class="card"><span>Requests executadas</span><strong>${stats.requestsTotal}</strong></div>
      <div class="card"><span>Assertions</span><strong>${stats.assertionsTotal}</strong></div>
      <div class="card"><span>Falhas</span><strong class="${stats.assertionsFailed ? 'bad' : 'ok'}">${stats.assertionsFailed}</strong></div>
    </div>
    <section>
      <h2>Resultado por requisição</h2>
      <table>
        <thead><tr><th>Cenário</th><th>Método</th><th>Status</th><th>Tempo</th><th>Resultado</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="5">Nenhuma execução encontrada.</td></tr>'}</tbody>
      </table>
    </section>
    <section>
      <h2>Detalhamento de falhas</h2>
      <table>
        <thead><tr><th>Cenário</th><th>Teste</th><th>Mensagem</th></tr></thead>
        <tbody>${failureRows}</tbody>
      </table>
    </section>
    <section>
      <h2>Relatório Newman</h2>
      <p><a href="./newman-report.html">Abrir relatório detalhado</a></p>
    </section>
  </main>
</body>
</html>`;

fs.writeFileSync(path.join(publicDir, 'index.html'), html);

const detailedReport = path.join(process.cwd(), 'reports', 'index.html');
if (fs.existsSync(detailedReport)) {
  fs.copyFileSync(detailedReport, path.join(publicDir, 'newman-report.html'));
}

fs.writeFileSync(path.join(publicDir, '.nojekyll'), '');

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
