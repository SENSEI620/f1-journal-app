# Como gerar o APK (sem Android Studio)

Quem compila é o GitHub, de graça. Você só sobe os arquivos e baixa o APK pronto.

1. Entre em github.com e crie uma conta (se ainda não tem).
2. Clique em **New repository**, dê o nome `f1-studio-app`, marque **Private** e crie.
3. Clique em **uploading an existing file** e arraste **o conteúdo** da pasta do app (as pastas `www`, `scripts`, `.github` e os arquivos `package.json`, `capacitor.config.json`). Não precisa subir `node_modules` nem `test`.
   - Atenção: a pasta `.github` é escondida no Windows. Ative "Itens ocultos" no Explorador para ver e arrastar ela. Sem ela o GitHub não sabe compilar.
4. Clique em **Commit changes**.
5. Vá na aba **Actions** > **Gerar APK** > **Run workflow**. Espere uns 5 a 10 minutos até ficar verde.
6. Abra a execução que terminou e, no fim da página, em **Artifacts**, baixe **F1-Journal-Studio-App** (vem um zip com o `.apk`).
7. Mande o `.apk` pro celular, abra e permita "instalar de fonte desconhecida".

Se ficar vermelho, copie o texto do erro (aba da etapa que falhou) e me mande.

## Teste rápido no PC (sem APK)
`npm install` e depois `npm run testar` (precisa do Chromium do Playwright).
