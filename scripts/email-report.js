const fs = require('fs');
const path = require('path');

const reportPath = path.join(process.cwd(), 'reports', 'newman-report.json');
const reportsDir = path.join(process.cwd(), 'reports');
fs.mkdirSync(reportsDir, { recursive: true });

let summary = null;
let failures = [];
let collectionName = '[QA] Testes - OLX';

if (fs.existsSync(reportPath)) {
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  summary = report.run?.stats || {};
  failures = report.run?.failures || [];
  collectionName = report.collection?.name || collectionName;
}

const stats = {
  requestsTotal: summary?.requests?.total || 0,
  assertionsTotal: summary?.assertions?.total || 0,
  assertionsFailed: summary?.assertions?.failed || 0,
  timestamp: new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
};

const successRate = stats.assertionsTotal > 0
  ? Math.round(((stats.assertionsTotal - stats.assertionsFailed) / stats.assertionsTotal) * 100)
  : 0;

const pagesUrl = process.env.PAGES_URL || '#';
const runUrl = process.env.RUN_URL || '#';
const isForcedTest = process.env.FORCE_TEST === 'true' && failures.length === 0;

const theme = isForcedTest
  ? { gradient: 'linear-gradient(135deg,#4f46e5,#4338ca)', eyebrow: 'Envio de teste', title: 'Teste de envio de e-mail — OLX', intro: `Este é um envio manual de teste solicitado no GitHub Actions para <strong>${escapeHtml(collectionName)}</strong>. Nenhuma falha real foi detectada nesta execução.` }
  : { gradient: 'linear-gradient(135deg,#dc2626,#b91c1c)', eyebrow: 'Alerta automático', title: 'Falhas nos testes de API — OLX', intro: `A execução programada de <strong>${escapeHtml(collectionName)}</strong> encontrou falhas.` };

const failureRows = failures.length
  ? failures.map((failure) => `
    <tr>
      <td style="padding:14px 16px;border-bottom:1px solid #f1e3e3;font-family:Arial,sans-serif;font-size:13px;color:#7a1f1f;font-weight:700;vertical-align:top;">${escapeHtml(failure.source?.name || 'Sem nome')}</td>
      <td style="padding:14px 16px;border-bottom:1px solid #f1e3e3;font-family:Arial,sans-serif;font-size:13px;color:#444;vertical-align:top;">${escapeHtml(failure.error?.test || '-')}</td>
      <td style="padding:14px 16px;border-bottom:1px solid #f1e3e3;font-family:Arial,sans-serif;font-size:13px;color:#666;vertical-align:top;">${escapeHtml(failure.error?.message || '-')}</td>
    </tr>`).join('\n')
  : '';

const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Alerta de falhas - QA OLX</title>
</head>
<body style="margin:0;padding:0;background-color:#f2f4f8;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f2f4f8;padding:32px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 18px rgba(20,20,40,.08);">

          <tr>
            <td style="background:${theme.gradient};padding:28px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <p style="margin:0;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:rgba(255,255,255,.85);font-weight:700;">${theme.eyebrow}</p>
                    <h1 style="margin:6px 0 0;font-size:22px;color:#ffffff;font-weight:800;">${theme.title}</h1>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:28px 32px 8px;">
              <p style="margin:0 0 4px;font-size:14px;color:#333;">
                ${theme.intro}
              </p>
              <p style="margin:0;font-size:13px;color:#8a8f9c;">Executado em ${stats.timestamp}</p>
            </td>
          </tr>

          <tr>
            <td style="padding:20px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="33%" style="padding:14px;background:#fef2f2;border-radius:12px 0 0 12px;text-align:center;border:1px solid #fde2e2;border-right:none;">
                    <p style="margin:0;font-size:11px;color:#9a3f3f;text-transform:uppercase;letter-spacing:.04em;">Taxa de sucesso</p>
                    <p style="margin:6px 0 0;font-size:24px;font-weight:800;color:#dc2626;">${successRate}%</p>
                  </td>
                  <td width="34%" style="padding:14px;background:#fef2f2;text-align:center;border-top:1px solid #fde2e2;border-bottom:1px solid #fde2e2;">
                    <p style="margin:0;font-size:11px;color:#9a3f3f;text-transform:uppercase;letter-spacing:.04em;">Assertions falhas</p>
                    <p style="margin:6px 0 0;font-size:24px;font-weight:800;color:#dc2626;">${stats.assertionsFailed}</p>
                  </td>
                  <td width="33%" style="padding:14px;background:#fef2f2;border-radius:0 12px 12px 0;text-align:center;border:1px solid #fde2e2;border-left:none;">
                    <p style="margin:0;font-size:11px;color:#9a3f3f;text-transform:uppercase;letter-spacing:.04em;">Requests testadas</p>
                    <p style="margin:6px 0 0;font-size:24px;font-weight:800;color:#dc2626;">${stats.requestsTotal}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:8px 32px 0;">
              <p style="margin:0 0 10px;font-size:14px;font-weight:700;color:#1f2430;">Detalhe das falhas</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #f1e3e3;border-radius:10px;overflow:hidden;">
                <thead>
                  <tr style="background:#fbfbfd;">
                    <th align="left" style="padding:10px 16px;font-size:11px;text-transform:uppercase;color:#8a8f9c;letter-spacing:.04em;">Cenário</th>
                    <th align="left" style="padding:10px 16px;font-size:11px;text-transform:uppercase;color:#8a8f9c;letter-spacing:.04em;">Teste</th>
                    <th align="left" style="padding:10px 16px;font-size:11px;text-transform:uppercase;color:#8a8f9c;letter-spacing:.04em;">Mensagem</th>
                  </tr>
                </thead>
                <tbody>
                  ${failureRows || '<tr><td colspan="3" style="padding:14px 16px;font-size:13px;color:#666;">Nenhum detalhe disponível.</td></tr>'}
                </tbody>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:28px 32px;" align="center">
              <a href="${pagesUrl}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:13px 26px;border-radius:10px;">
                Abrir dashboard completo
              </a>
              <p style="margin:14px 0 0;font-size:12px;color:#9aa0ad;">
                Ou veja os logs da execução: <a href="${runUrl}" style="color:#4f46e5;text-decoration:none;">acessar workflow no GitHub</a>
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:18px 32px;background:#fafafc;border-top:1px solid #eef0f4;" align="center">
              <p style="margin:0;font-size:11.5px;color:#9aa0ad;">Enviado automaticamente pela pipeline de testes de API · OLX QA</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

fs.writeFileSync(path.join(reportsDir, 'email-body.html'), html);

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}