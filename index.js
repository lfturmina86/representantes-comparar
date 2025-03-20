const express = require('express');
const { google } = require('googleapis');
const bodyParser = require('body-parser');
const session = require('express-session');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Configuração do Google Sheets API
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
const sheets = google.sheets({ version: 'v4', auth: oauth2Client });

// Middleware para JSON e Sessões
app.use(bodyParser.json());
app.use(session({
  secret: 'secret-key',
  resave: false,
  saveUninitialized: true,
}));

// Rota para a raiz ("/")
app.get('/', (req, res) => {
  res.send(`
    <h1>Bem-vindo ao App de Comparação de Representantes</h1>
    <p><a href="/auth">Autentique-se com o Google</a></p>
    <button onclick="fetchTopItems(3)">Top 5 (3 meses)</button>
    <button onclick="fetchTopItems(6)">Top 5 (6 meses)</button>
    <button onclick="fetchTopItems(12)">Top 5 (12 meses)</button>
    <div id="result"></div>
    <script>
      async function fetchTopItems(months) {
        try {
          const response = await fetch(\`/getTopItems?months=\${months}\`);
          const data = await response.json();
          document.getElementById('result').innerHTML = data.tableHtml;
        } catch (error) {
          console.error('Erro ao buscar dados:', error);
          document.getElementById('result').innerHTML = 'Erro ao buscar dados, tente novamente.';
        }
      }
    </script>
  `);
});

// Autenticação e autorização do Google OAuth2
app.get('/auth', (req, res) => {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
  });
  res.redirect(authUrl);
});

// Rota de callback do Google OAuth2
app.get('/oauth2callback', async (req, res) => {
  const { code } = req.query;
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);
  
  // Armazenando tokens de forma segura (usando sessão)
  req.session.tokens = tokens;
  
  res.redirect('/');
});

// Função para ler dados do Google Sheets
app.get('/getSheetData', async (req, res) => {
  const spreadsheetId = process.env.SPREADSHEET_ID;
  const range = 'PB NOVO!A1:Z1000';

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });
    res.json(response.data.values);
  } catch (error) {
    res.status(500).send('Erro ao obter dados do Google Sheets');
  }
});

// Função para gerar tabela HTML dos dados
function generateHtmlTable(data) {
  let html = '<table border="1"><tr><th>Representante</th><th>Soma do VLR</th><th>Item</th><th>Quantidade</th></tr>';
  data.forEach(entry => {
    html += `<tr><td>${entry.rep}</td><td>${entry.totalVLR}</td><td>${entry.item}</td><td>${entry.quantity}</td></tr>`;
  });
  html += '</table>';
  return html;
}

// Rota para obter os top 5 itens mais vendidos por representante
app.get('/getTopItems', async (req, res) => {
  const spreadsheetId = process.env.SPREADSHEET_ID;
  const range = 'PB NOVO!A1:Z1000';
  const months = parseInt(req.query.months) || 3;

  try {
    const response = await sheets.spreadsheets.values.get({ spreadsheetId, range });
    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Nenhum dado encontrado' });
    }

    const headers = rows[0];
    const dateIndex = headers.indexOf("DT EMIS");
    const repIndex = headers.indexOf("COD REP");
    const itemIndex = headers.indexOf("ITEM");
    const qtyIndex = headers.indexOf("VLR");

    if (dateIndex === -1 || repIndex === -1 || itemIndex === -1 || qtyIndex === -1) {
      return res.status(500).json({ error: "Estrutura da planilha inválida" });
    }

    const now = new Date();
    const filteredData = rows.slice(1)
      .map(row => ({
        date: new Date(row[dateIndex]),
        rep: row[repIndex] ? String(row[repIndex]).trim() : '', // Garantir que o COD REP seja tratado como string
        item: row[itemIndex],
        quantity: parseInt(row[qtyIndex]) || 0,
        VLR: parseFloat(row[qtyIndex]) || 0
      }))
      .filter(entry => {
        const diffMonths = (now.getFullYear() - entry.date.getFullYear()) * 12 + (now.getMonth() - entry.date.getMonth());
        return diffMonths <= months;
      });

    const repMap = {};
    filteredData.forEach(({ rep, item, quantity, VLR }) => {
      if (!rep) return; // Ignorar registros sem representante
      if (!repMap[rep]) repMap[rep] = {};
      if (!repMap[rep][item]) repMap[rep][item] = { quantity: 0, totalVLR: 0 };
      repMap[rep][item].quantity += quantity;
      repMap[rep][item].totalVLR += VLR;
    });

    const result = Object.keys(repMap).map(rep => ({
      rep, // O "COD REP" agora é tratado como string (char)
      topItems: Object.entries(repMap[rep])
        .map(([item, { quantity, totalVLR }]) => ({ item, quantity, totalVLR }))
        .sort((a, b) => b.totalVLR - a.totalVLR) // Ordena por totalVLR em ordem decrescente
    }));

    // Organizar por COD REP (rep)
    result.sort((a, b) => a.rep.localeCompare(b.rep));

    // Gerar tabela HTML
    const tableHtml = generateHtmlTable(result.flatMap(rep => rep.topItems));

    res.json({ tableHtml });
  } catch (error) {
    console.error(error);
    res.status(500).send('Erro ao processar os dados');
  }
});

// Iniciando o servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});

module.exports = app;
