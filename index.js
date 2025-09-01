// Importa o Express
const express = require('express');
const path = require('path');
// Inicializa o app
const app = express();

// Middleware para interpretar JSON (caso você queira receber dados via POST futuramente)
app.use(express.json());
// Serve arquivos estáticos da pasta 'public'
app.use(express.static(path.join(__dirname, 'public')));

// Define a porta que o Render fornece ou usa 3000 localmente
const PORT = process.env.PORT || 3000;

const pool = require("./db"); // <-- Arquivo de conexão com o PostgreSQL


// Rota de verificação
app.get('/verificar', (req, res) => {
  res.json({
    status: 'online',
    mensagem: 'API funcionando!'
  });
});

app.post("/admin/sql", async (req, res) => {
  const { sql } = req.body;
  try {
    const { rows } = await pool.query(sql);
    res.send(JSON.stringify(rows, null, 2));
  } catch (err) {
    console.error("Erro SQL:", err.message);
    res.status(400).send("Erro SQL: " + err.message);
  }
});

// Inicia o servidor
app.listen(PORT, () => {
  console.log(`✅ Servidor rodando na porta ${PORT}`);
});


