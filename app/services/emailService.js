const escapeHtml = (valor) => {
  const texto = String(valor ?? '');
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

const criarTemplateEmail = ({
  titulo,
  cabecalho,
  mensagem,
  textoBotao,
  linkBotao,
  validade,
  rodape,
  nomeUsuario
}) => {
  const nome = escapeHtml(nomeUsuario || 'Usuário');
  const tituloSegur = escapeHtml(titulo || 'EcoGeneration');
  const cabecalhoSegur = escapeHtml(cabecalho || 'EcoGeneration');
  const mensagemSegura = escapeHtml(mensagem || '');
  const textoBotaoSegur = escapeHtml(textoBotao || 'Acessar');
  const validadeSegura = escapeHtml(validade || '');
  const rodapeSegur = escapeHtml(rodape || 'EcoGeneration');

  return `
    <div style="margin:0;padding:0;background:#eefaf2;font-family:Arial,Helvetica,sans-serif;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eefaf2;padding:32px 16px;">
        <tr>
          <td align="center">
            <div style="max-width:600px;width:100%;background:#ffffff;border:1px solid #dfeee4;border-radius:18px;box-shadow:0 6px 24px rgba(31,95,58,0.08);overflow:hidden;">
              <div style="background:linear-gradient(135deg,#1b5e20,#2e7d32,#4caf50);padding:28px 24px;text-align:center;">
                <div style="font-size:12px;letter-spacing:2px;color:#e8f5e9;text-transform:uppercase;font-weight:bold;">EcoGeneration</div>
                <h1 style="margin:12px 0 0;color:#ffffff;font-size:28px;line-height:1.3;">${tituloSegur}</h1>
              </div>
              <div style="padding:32px 24px 20px; color:#1f2d1b;">
                <p style="margin:0 0 16px; font-size:16px; line-height:1.6;">Olá, <strong>${nome}</strong>!</p>
                <h2 style="margin:0 0 16px; color:#1b5e20; font-size:22px;">${cabecalhoSegur}</h2>
                <p style="margin:0 0 20px; font-size:16px; line-height:1.7;">${mensagemSegura}</p>
                <div style="text-align:center; margin:28px 0;">
                  <a href="${linkBotao}" style="display:inline-block;background:#2e7d32;color:#ffffff;text-decoration:none;padding:14px 26px;border-radius:10px;font-weight:bold;font-size:16px;">${textoBotaoSegur}</a>
                </div>
                <p style="margin:0 0 12px; font-size:14px; line-height:1.6; color:#3f4d3d;">Se o botão não funcionar, use este link:</p>
                <p style="margin:0 0 20px; word-break:break-all; font-size:13px; line-height:1.6; color:#1b5e20;">${linkBotao}</p>
                <p style="margin:0 0 10px; font-size:14px; line-height:1.6; color:#3f4d3d;">Validade do link: <strong>${validadeSegura}</strong></p>
              </div>
              <div style="background:#f5faf6;border-top:1px solid #e1efe3;padding:18px 24px;text-align:center;color:#4d5d4a;font-size:12px;line-height:1.6;">
                ${rodapeSegur}
              </div>
            </div>
          </td>
        </tr>
      </table>
    </div>
  `;
};

const criarTemplateResetSenha = ({ nomeUsuario, appBaseUrl, token }) => {
  const appBase = String(appBaseUrl || process.env.APP_BASE_URL || 'http://localhost:3000');
  const link = `${appBase}/resetar-senha?token=${encodeURIComponent(token)}`;

  return criarTemplateEmail({
    titulo: 'Redefinição de senha',
    cabecalho: 'Solicitamos a redefinição da sua senha',
    mensagem: 'Clique no botão abaixo para criar uma nova senha. Se você não solicitou essa alteração, pode ignorar este e-mail com segurança.',
    textoBotao: 'Redefinir senha',
    linkBotao: link,
    validade: '1 hora',
    rodape: 'EcoGeneration • Sua energia mais consciente.',
    nomeUsuario
  });
};

const criarTemplateAtivacaoConta = ({ nomeUsuario, appBaseUrl, token }) => {
  const appBase = String(appBaseUrl || process.env.APP_BASE_URL || 'http://localhost:3000');
  const link = `${appBase}/ativar-conta?token=${encodeURIComponent(token)}`;

  return criarTemplateEmail({
    titulo: 'Ative sua conta',
    cabecalho: 'Seu cadastro foi concluído com sucesso',
    mensagem: 'Clique no botão abaixo para ativar sua conta e começar a aproveitar a EcoGeneration. Caso você não tenha criado esta conta, pode ignorar este e-mail.',
    textoBotao: 'Ativar conta',
    linkBotao: link,
    validade: '24 horas',
    rodape: 'EcoGeneration • A sua jornada em direção à autonomia energética.',
    nomeUsuario
  });
};

const enviarEmail = async ({ para, assunto, html }) => {
  const emailDestino = String(para || '').trim();
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    throw new Error('RESEND_API_KEY não configurada');
  }

  if (!process.env.EMAIL_FROM) {
    throw new Error('EMAIL_FROM não configurado');
  }

  if (!emailDestino) {
    throw new Error('Destinatário não informado');
  }

  const resposta = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM,
      to: [emailDestino],
      subject: assunto,
      html
    })
  });

  if (!resposta.ok) {
    let detalhe;
    try {
      detalhe = await resposta.json();
    } catch (erro) {
      detalhe = await resposta.text();
    }

    const erro = new Error(`Falha ao enviar e-mail via Resend (${resposta.status}).`);
    erro.statusCode = resposta.status;
    erro.detalhes = detalhe;
    throw erro;
  }

  return resposta.json();
};

module.exports = {
  enviarEmail,
  criarTemplateEmail,
  criarTemplateResetSenha,
  criarTemplateAtivacaoConta,
  escapeHtml
};