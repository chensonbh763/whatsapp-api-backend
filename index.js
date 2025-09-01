// Importa o Express
const express = require('express');

// Inicializa o app
const app = express();

// Middleware para interpretar JSON (caso você queira receber dados via POST futuramente)
app.use(express.json());

// Define a porta que o Render fornece ou usa 3000 localmente
const PORT = process.env.PORT || 3000;

// Rota de verificação
app.get('/verificar', (req, res) => {
  res.json({
    status: 'online',
    mensagem: 'API funcionando!'
  });
});

// Inicia o servidor
app.listen(PORT, () => {
  console.log(`✅ Servidor rodando na porta ${PORT}`);
});
