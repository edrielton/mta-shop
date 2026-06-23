MTA Store Scanner v5.0
======================

COMO USAR:
  Windows:  Clique duas vezes em ABRIR-SCANNER.bat
  Navegador: Abra MTA-Store-Scanner.html no Chrome ou Edge

CONFIGURACAO:
  1. URL do Site: https://mtastore.site (preenchido automaticamente)
  2. Token: cole o mesmo token do config.lua do resource mta_store
  3. Pasta: selecione a pasta "resources" do servidor MTA
  4. Profundidade: quantas subpastas scanear (1-20, default 10)

COMO FUNCIONA:
  1. Scanner entra recursivamente nas subpastas do resources
  2. Para cada pasta com meta.xml, le os arquivos .lua
  3. Detecta comandos de venda (giveVip, giveVehicle, etc)
  4. Classifica por categoria: VIP, Vehicle, Coins, Weapon, House, Job
  5. Estima precos por categoria
  6. Envia para o site → cria produtos automaticamente (inativos)
  7. Admin ativa os produtos na aba Produtos

CATEGORIAS E PRECOS:
  VIP 👑     R$19,90 - R$99,90  (gold, prata, diamond, premium, etc)
  Vehicle 🚗 R$15,00 - R$75,00  (basico, standard, premium, exclusivo)
  Coins 💰   R$5,00 - R$30,00   (1000, 5000, 15000, 50000 moedas)
  Weapon 🔫  R$10,00 - R$35,00  (starter, premium, elite)
  House 🏠   R$20,00 - R$60,00  (pequena, media, grande, mansao)
  Job 💼     R$8,00 - R$25,00   (acesso a empregos exclusivos)

CORES DOS ITENS NO SCANNER:
  Amarelo = VIP detectado
  Azul    = Veiculo
  Verde   = Moedas
  Vermelho = Armas
  Laranja = Casas
  Ciano   = Empregos
  Roxo    = Kit/Item

COMANDOS NO MTA:
  /loja ou /store ou /shop  - gera link de acesso a loja
  /storesync               - escanea e envia mods pelo proprio MTA

ERROS COMUNS:
  - 401: token invalido, verifique config.lua
  - 404: URL incorreta ou site offline
  - 413: dados muito grandes (scanner ja otimiza automaticamente)
  - 500: erro interno do servidor
  - 503: servidor MTA offline ou inacessivel
  - 504: servidor MTA nao respondeu a tempo (15s)
  - CORS: abra via ABRIR-SCANNER.bat (servidor HTTP local)
  - URL sempre com https:// no inicio

ARQUIVOS:
  ABRIR-SCANNER.bat          - Abre o HTML via servidor local Python
  MTA-Store-Scanner.html     - v5.0 Scanner para browser (Chrome/Edge)
  MTA-Store-Scanner.ps1      - v4.0 Scanner para Windows (GUI)
  README.txt                 - Este arquivo
