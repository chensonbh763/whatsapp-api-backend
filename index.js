import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import dotenv from "dotenv";
import cors from "cors";
dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;
app.use(cors());
app.use(express.static("public"));
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

// ✅ Rota para executar comandos SQL via painel admin
app.post("/admin/sql", async (req, res) => {
  const { sql } = req.body;

  if (!sql || typeof sql !== "string") {
    return res.status(400).send("❌ Comando SQL inválido.");
  }

  try {
    const result = await db.query(sql);

    // Se houver linhas retornadas, envia como JSON
    if (result.rows && result.rows.length > 0) {
      res.json(result.rows);
    } else if (result.command === "INSERT" || result.command === "UPDATE" || result.command === "DELETE") {
      res.send(`✅ Comando executado com sucesso: ${result.command}`);
    } else {
      res.send("✅ Comando executado, sem retorno.");
    }
  } catch (err) {
    console.error("❌ Erro ao executar SQL:", err);
    res.status(500).send("❌ Erro ao executar SQL: " + err.message);
  }
});

app.listen(PORT, () => {
  console.log(`Servidor Central rodando na porta ${PORT}`);
});



