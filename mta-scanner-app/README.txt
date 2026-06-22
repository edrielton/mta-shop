MTA Store Scanner v3.0
======================

COMO USAR:
  Windows:  Clique duas vezes em ABRIR-SCANNER.bat
  Navegador: Abra MTA-Store-Scanner.html no Chrome ou Edge

CONFIGURACAO:
  1. URL do Site: https://mtastore.site (preenchido automaticamente)
  2. Token: cole o mesmo token do config.lua do resource mta_store
  3. Pasta: selecione a pasta "resources" do servidor MTA

CORES DOS ITENS:
  Amarelo = VIP detectado
  Azul    = Veiculo
  Verde   = Moedas
  Roxo    = Kit/Item
  Verde   = Comando auto-detectado (checkmark)

COMANDOS NO MTA:
  /loja ou /store ou /shop  - gera link de acesso a loja
  /storesync               - escanea e envia mods pelo proprio MTA

ERROS COMUNS:
  - 401: token invalido, verifique config.lua
  - 404: URL incorreta ou site offline
  - Timeout: site offline ou firewall bloqueando
  - URL sempre com https:// no inicio
