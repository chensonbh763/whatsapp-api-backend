import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import dotenv from "dotenv";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());

// 🔹 Conexão com o PostgreSQL (Render)
const db = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});
db.connect();

// ✅ Rota para verificar se servidor está online
app.get("/verificar", (req, res) => {
  res.json({ status: "online", message: "Servidor Central rodando 🚀" });
});

// ✅ Rota para status do cliente (Grátis ou Premium)
app.get("/statusCliente", async (req, res) => {
  const { email } = req.query;
  if (!email) return res.status(400).json({ error: "Informe um e-mail" });

  try {
    const result = await db.query(
      `SELECT u.email, p.nome AS plano
       FROM usuarios u
       JOIN planos p ON u.plano_id = p.id
       WHERE u.email = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      return res.json({ email, plano: "Gratuito" }); // se não achar, padrão grátis
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro no servidor" });
  }
});

// ✅ Rota de atualização
app.get("/atualizacao", (req, res) => {
  res.json({
    versao: "1.0.0",
    url: "https://meu-servidor.com/downloads/automazap-1.0.0.zip",
    obrigatoria: false
  });
});

app.listen(PORT, () => {
  console.log(`Servidor Central rodando na porta ${PORT}`);
});
