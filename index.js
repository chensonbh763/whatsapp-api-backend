const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/verificar', (req, res) => {
  res.json({ status: 'online', mensagem: 'API funcionando!' });
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});