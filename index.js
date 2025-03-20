const express = require('express');
const { google } = require('googleapis');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuração do Google Sheets API
const CLIENT_ID = '911431976768-249r4fdg228co8lbbjcfdateq3bhqcm5.apps.googleusercontent.com';
const CLIENT_SECRET = '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';
const REDIRECT_URI = 'https://representantes-comparar.vercel.app/oauth2callback';  // URL de callback da Vercel

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
const sheets = google.sheets({ version: 'v4', auth: oauth2Client });

// Middleware para JSON
app.use(bodyParser.json());

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
  const spreadsheetId = '1WklxIh-FT_Rxpxqo8PRHV1vpj55wAZhdG46wpLuijOs';  // Substitua pelo ID do seu Google Sheet
  const range = 'PB NOVO!A1:Z1000';  // Ajuste o intervalo conforme necessário

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

// Exportando para a Vercel
module.exports = app;
