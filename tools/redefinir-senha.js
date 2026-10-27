// Redefine a senha de qualquer usuário, inclusive do mestre.
// Rode com a mesa FECHADA:  node tools/redefinir-senha.js   (ou redefinir-senha.bat no Windows, ./redefinir-senha.sh no Linux e no Mac)
const net = require('net');
const crypto = require('crypto');
const readline = require('readline/promises');

const PORT = Number(process.env.PORT) || 3000;

function mesaAberta() {
  return new Promise((resolve) => {
    const s = net.connect(PORT, '127.0.0.1');
    s.once('connect', () => { s.destroy(); resolve(true); });
    s.once('error', () => resolve(false));
  });
}

(async () => {
  if (await mesaAberta()) {
    console.log(`\n  A mesa está aberta (porta ${PORT}). Feche a mesa antes de redefinir senhas.\n`);
    process.exit(1);
  }
  const store = require('../server/store');
  const users = store.data.users;
  if (!users.length) {
    console.log(`\n  Nenhum usuário encontrado em ${store.FILE}\n`);
    process.exit(1);
  }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const papel = { gm: 'mestre', player: 'jogador', viewer: 'telão' };
  console.log(`\n  Campanha: ${store.FILE}\n`);
  users.forEach((u, i) => console.log(`  ${i + 1}) ${u.name} (${papel[u.role] || u.role})`));
  const n = Number(await rl.question('\n  Número do usuário: '));
  const user = users[n - 1];
  if (!user) { console.log('  Número inválido.'); process.exit(1); }
  const pw = await rl.question(`  Nova senha para ${user.name}: `);
  if (pw.length < 4) { console.log('  A senha precisa ter pelo menos 4 caracteres.'); process.exit(1); }
  rl.close();

  user.salt = crypto.randomBytes(16).toString('hex');
  user.hash = crypto.scryptSync(pw, user.salt, 64).toString('hex');
  for (const [t, id] of Object.entries(store.data.sessions)) if (id === user.id) delete store.data.sessions[t];
  store.flush();
  console.log(`\n  ✓ Senha de ${user.name} redefinida.\n`);
})();
