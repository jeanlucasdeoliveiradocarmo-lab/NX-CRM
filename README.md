# CRM com Next.js e Firebase

Projeto simples de CRM usando Next.js App Router, Tailwind CSS, Firebase Authentication e Cloud Firestore.

## 1. Configurar o Firebase

1. Crie um projeto no [Firebase Console](https://console.firebase.google.com/).
2. Registre um aplicativo Web e copie os valores de configuracao.
3. Em **Authentication > Sign-in method**, habilite **E-mail/senha**.
4. Em **Authentication > Users**, crie pelo menos um usuario.
5. Crie um banco **Cloud Firestore**.
6. Publique o conteudo de `firestore.rules` na aba **Firestore > Rules**.
7. Em **Project settings > Service accounts**, gere uma chave privada para a API.

O UID do usuario criado no Authentication sera o `clienteId` enviado ao endpoint de leads.

## 2. Configurar as variaveis locais

Copie `.env.example` para `.env.local` e preencha:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=seu-projeto.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=seu-projeto
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=seu-projeto.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...

FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@seu-projeto.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

As variaveis `NEXT_PUBLIC_*` fazem parte da configuracao publica do SDK Web. `FIREBASE_PRIVATE_KEY` e `FIREBASE_CLIENT_EMAIL` sao segredos e nunca devem ser enviados ao navegador ou versionados.

## 3. Rodar localmente

```bash
npm install
npm run dev
```

Acesse [http://localhost:3000/login](http://localhost:3000/login).

## 4. Criar um lead pela API

Substitua `UID_DO_USUARIO` pelo UID encontrado no Firebase Authentication:

```bash
curl -X POST http://localhost:3000/api/v1/leads \
  -H "Content-Type: application/json" \
  -d '{
    "clienteId": "UID_DO_USUARIO",
    "nome": "Maria Silva",
    "email": "maria@exemplo.com",
    "telefone": "+55 11 99999-9999",
    "mensagem": "Quero saber mais sobre o produto."
  }'
```

A resposta de sucesso usa HTTP `201`:

```json
{
  "id": "ID_GERADO_PELO_FIRESTORE",
  "message": "Lead criado com sucesso."
}
```

## 5. Publicar na Vercel

1. Envie o projeto para um repositorio Git.
2. Importe o repositorio na Vercel.
3. Cadastre todas as variaveis de `.env.example` em **Project Settings > Environment Variables** para Production, Preview e Development, conforme necessario.
4. Faca o deploy.
5. Em **Firebase Authentication > Settings > Authorized domains**, confirme que o dominio da Vercel esta autorizado.

## Estrutura principal

```text
app/
  api/v1/leads/route.js
  dashboard/page.js
  login/page.js
  globals.css
  layout.js
  page.js
lib/
  firebase.js
  firebase-admin.js
.env.example
firestore.rules
```

## Observacao de producao

O endpoint recebe `clienteId` porque ele foi pensado para formularios publicos de captacao. Antes de expor a API em producao, adicione protecao contra abuso, como rate limiting, App Check ou CAPTCHA.
