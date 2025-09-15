import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import dotenv from "dotenv";
import cors from "cors";
dotenv.config();
const PORT = process.env.PORT || 3000;
import multer from "multer";
import path from "path";
import fs from "fs";

const app = express();
const upload = multer({ dest: "temp/" }); // pasta temporária

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
// ✅ Rota de ping (root)
app.get('/', (req, res) => {
  res.send('🟢 Servidor ativo');
});
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

    // 3. Verifica se o dispositivo já está registrado
    const jaRegistrado = await db.query(
      `SELECT 1 FROM acessos WHERE email = $1 AND dispositivo_id = $2`,
      [email, dispositivo_id]
    );

    if (jaRegistrado.rowCount === 0) {
      // 4. Se não estiver, insere novo acesso
      await db.query(
        `INSERT INTO acessos (email, ip, dispositivo_id) VALUES ($1, $2, $3)`,
        [email, ip, dispositivo_id]
      );
    } else {
      // (Opcional) Atualiza data_login e IP se quiser manter o registro atualizado
      await db.query(
        `UPDATE acessos SET data_login = CURRENT_TIMESTAMP, ip = $1
         WHERE email = $2 AND dispositivo_id = $3`,
        [ip, email, dispositivo_id]
      );
    }

    // 5. Verifica limite de dispositivos distintos
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


app.post("/upload", upload.single("arquivo"), (req, res) => {
  const { email, contato } = req.body;
  const arquivo = req.file;

  if (!email || !contato || !arquivo) {
    return res.status(400).send("Parâmetros ausentes ou arquivo não enviado");
  }

  const destinoPasta = path.join("uploads", email, contato);
  if (!fs.existsSync(destinoPasta)) {
    fs.mkdirSync(destinoPasta, { recursive: true });
  }

  const destinoFinal = path.join(destinoPasta, arquivo.originalname);
  fs.renameSync(arquivo.path, destinoFinal);

  res.send("✅ Arquivo recebido e organizado");
});

app.listen(3000, () => {
  console.log("🌐 Servidor externo rodando");
});

app.post("/webhook", async (req, res) => {
  const { data, event } = req.body;

  try {
    // 1. Sempre armazena o JSON
    await db.query(
      `INSERT INTO recebido (json_data) VALUES ($1::jsonb)`,
      [JSON.stringify(req.body)]
    );

    // 2. Trata evento de compra aprovada
    if (event === "purchase_approved") {
      const comprador = data.customer || {};
      const nome = comprador.name || "Cliente Automazap";
      const email = comprador.email;
      const celular = comprador.phone || null;
      const cpf = comprador.docNumber || null;

      if (!email) {
        return res.status(400).send("❌ E-mail do comprador ausente");
      }

      await db.query(
        `INSERT INTO usuarios (nome, email, senha_hash, plano_id, criado_em, celular, cpf, ip)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, $5, $6, NULL)
         ON CONFLICT (email) DO NOTHING`,
        [nome, email, "hash_senha_premium", 2, celular, cpf]
      );

      console.log(`✅ Usuário criado: ${email}`);
      return res.status(200).send("✅ Webhook recebido e usuário criado");
    }

    // 3. Trata evento de reembolso
    if (event === "refund" || event === "purchase_refunded") {
      const email = data.customer?.email;
      if (!email) {
        return res.status(400).send("❌ E-mail do comprador ausente no reembolso");
      }

      // opção A: excluir usuário
      // await db.query("DELETE FROM usuarios WHERE email = $1", [email]);

      // opção B: apenas remover premium (mais seguro)
      await db.query(
        `UPDATE usuarios SET plano_id = 1 WHERE email = $1`,
        [email]
      );

      console.log(`❌ Usuário reembolsado removido/downgrade: ${email}`);
      return res.status(200).send("✅ Reembolso processado");
    }

    // 4. Outros eventos → só confirma
    res.status(200).send("Evento ignorado");
  } catch (err) {
    console.error("❌ Erro ao processar webhook:", err);
    res.status(500).send("Erro ao processar webhook");
  }
});


// ✅ rota para consultar última atualização
app.get("/api/updates/latest", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM updates ORDER BY created_at DESC LIMIT 1"
    );
    if (result.rows.length === 0) {
      return res.json({ success: false, message: "Nenhuma versão encontrada." });
    }
    res.json({ success: true, update: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Erro no servidor" });
  }
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











