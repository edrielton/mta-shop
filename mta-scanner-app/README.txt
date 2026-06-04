=============================================
 MTA STORE SCANNER v1.0
=============================================

Como usar:

OPÇÃO 1 — Rodar direto (precisa de Python)
  1. Instale Python: https://python.org/downloads
     (marque "Add Python to PATH")
  2. Clique duas vezes em: scanner.py

OPÇÃO 2 — Criar o .exe (recomendado)
  1. Instale Python: https://python.org/downloads
  2. Clique duas vezes em: build_exe.bat
  3. Aguarde criar o arquivo: MTA-Store-Scanner.exe
  4. Use o .exe normalmente, sem precisar de Python

=============================================
 CONFIGURAÇÃO NO APP
=============================================

1. Pasta Resources MTA:
   - Clique em "Selecionar"
   - Navegue até a pasta do seu servidor MTA
   - Selecione a pasta "resources"
   - Exemplo: C:\MTA\server\mods\deathmatch\resources

2. URL do Site:
   - URL do seu site hospedado no Railway
   - Exemplo: https://meuservidor.railway.app

3. Token MTA Store:
   - O mesmo token que está no config.lua do resource
   - Exemplo: seu-token-secreto-aqui

=============================================
 COMO FUNCIONA
=============================================

1. Clique em "Escanear Pasta"
   - O app lê TODOS os mods da pasta resources
   - Analisa os arquivos .lua de cada mod
   - Detecta sistemas de VIP (Gold, Prata, etc.)
   - Extrai comandos e exports automaticamente

2. Veja os resultados na tabela
   - Amarelo = VIP
   - Azul    = Veículo
   - Verde   = Moedas
   - Roxo    = Item/Kit

3. Clique em "Enviar pro Site"
   - Envia tudo para o painel admin do site
   - Os produtos aparecem na aba "Resources MTA"
   - Você só precisa definir o preço e ativar

4. (Opcional) "Exportar JSON"
   - Salva o resultado em um arquivo .json

=============================================
 DÚVIDAS
=============================================

Token incorreto → Verifique o config.lua do resource
Erro de conexão → Verifique se o site está online
Pasta inválida  → Selecione a pasta "resources" do MTA
