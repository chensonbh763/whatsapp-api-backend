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

app.get("/statusCliente", async (req, res) => {
  const { email } = req.query;

  if (!email) {
    return res.status(400).json({ erro: "Email é obrigatório" });
  }

  try {
    const result = await pool.query(`
      SELECT u.nome, u.email, p.nome AS plano
      FROM usuarios u
      JOIN planos p ON u.plano_id = p.id
      WHERE u.email = $1
    `, [email]);

    if (result.rows.length === 0) {
      return res.status(404).json({ erro: "Usuário não encontrado" });
    }

    const cliente = result.rows[0];
    const tipo = cliente.plano.toLowerCase() === "gratuito" ? "Grátis" : "Pago";

    res.json({
      nome: cliente.nome,
      email: cliente.email,
      plano: cliente.plano,
      tipo
    });
  } catch (err) {
    console.error("Erro ao consultar cliente:", err.message);
    res.status(500).json({ erro: "Erro interno do servidor" });
  }
});

// Inicia o servidor
app.listen(PORT, () => {
  console.log(`✅ Servidor rodando na porta ${PORT}`);
});



