# Demo TikTok (vídeo de app review)

Página pública: **https://alexandreaguiaralves.github.io/demo/**

## O que o vídeo precisa mostrar

- Domínio **`alexandreaguiaralves.github.io`** na barra do navegador.
- Links de **Privacidade** e **Termos** visíveis (header da home e da demo).
- Fluxo **Login Kit** (entrar com TikTok na sandbox).
- Uso de **Display API** (perfil + lista de vídeos) após o login.
- Apenas os **scopes/produtos** que você manteve no app no portal.

## Portal TikTok (Sandbox)

1. Modo **Sandbox** ativo no app.
2. **Login Kit** → Redirect URI exatamente:
   `https://alexandreaguiaralves.github.io/demo/callback/`
3. Adicione sua conta como **target user** no sandbox.
4. Scopes sugeridos para esta demo (ajuste se o app for diferente):
   - `user.info.basic`
   - `user.info.profile`
   - `video.list`

## Proxy OAuth (Cloudflare Worker — ~5 min)

O `client_secret` não pode ficar no GitHub Pages. Use o Worker em `demo/oauth-proxy/`:

```bash
cd demo/oauth-proxy
npm install -g wrangler
wrangler login
wrangler deploy
wrangler secret put TIKTOK_CLIENT_KEY
wrangler secret put TIKTOK_CLIENT_SECRET
```

Anote a URL publicada (ex.: `https://tiktok-demo-oauth.seu-usuario.workers.dev`) e cole em **/demo/** no campo “URL do proxy OAuth”.

## Gravar o vídeo

1. Home → mostrar legal links.
2. `/demo/` → salvar config → **Entrar com TikTok**.
3. Callback → perfil + tabela de vídeos.
4. Exportar `.mp4` ou `.mov` (máx. 50 MB) e anexar no submit do app.
