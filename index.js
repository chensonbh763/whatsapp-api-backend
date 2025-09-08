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

// ✅ Rota para liberar ou não cliente
app.get("/statusCliente", async (req, res) => {
  const { email, dispositivo_id } = req.query;
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;

  if (!email || !dispositivo_id) {
    return res.status(400).json({ error: "Informe email e dispositivo_id" });
  }

  try {
    // 1. Verifica plano
    const result = await db.query(
      `SELECT u.email, p.nome AS plano
       FROM usuarios u
       JOIN planos p ON u.plano_id = p.id
       WHERE u.email = $1`,
      [email]
    );

    const plano = result.rows[0]?.plano?.toLowerCase() || "gratuito";

    // 2. Se não for premium, retorna não autorizado
    if (plano !== "premium") {
      return res.json({ status: "nao_autorizado", motivo: "Plano gratuito" });
    }

    // 3. Registra acesso
    await db.query(
      `INSERT INTO acessos (email, ip, dispositivo_id) VALUES ($1, $2, $3)`,
      [email, ip, dispositivo_id]
    );

    // 4. Verifica limite de dispositivos
    const limite = await db.query(
      `SELECT COUNT(DISTINCT dispositivo_id) AS total
       FROM acessos
       WHERE email = $1`,
      [email]
    );

    const total = limite.rows[0].total;
    if (total > 3) {
      return res.json({ status: "nao_autorizado", motivo: "Limite de dispositivos excedido" });
    }

    // ✅ Tudo certo
    res.json({ status: "autorizado", plano, email });

  } catch (err) {
    console.error("Erro no servidor:", err);
    res.status(500).json({ error: "Erro interno ao verificar acesso" });
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




