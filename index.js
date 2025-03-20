const express = require('express');
const { google } = require('googleapis');
const path = require('path');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuração do Google Sheets API
const CLIENT_ID = 'SEU_CLIENT_ID';
const CLIENT_SECRET = 'SEU_CLIENT_SECRET';
const REDIRECT_URI = 'https://seu-dominio.vercel.app/oauth2callback';  // URL de callback da Vercel

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const sheets = google.sheets({ version: 'v4', auth: oauth2Client });

// Autenticação e autorização do Google OAuth2
app.get('/auth', (req, res) => {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
  });
  res.redirect(authUrl);
});

app.get('/oauth2callback', async (req, res) => {
  const { code } = req.query;
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);
  res.redirect('/');
});

// Função para ler dados do Google Sheets
app.get('/getSheetData', async (req, res) => {
  const spreadsheetId = 'SEU_SPREADSHEET_ID';  // Substitua pelo ID do seu Google Sheet
  const range = 'NOME_DA_ABA!A1:Z1000';  // Ajuste o intervalo conforme necessário

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

// Inicializa o servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
