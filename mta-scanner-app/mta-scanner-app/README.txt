MTA Store Scanner v2.0
=======================

Requisitos:
  - Python 3.7 ou superior
  - Nenhuma biblioteca externa necessaria

Como usar:
  1. Execute: python scanner.py
  2. Configure a URL do site (ex: https://mtastore.site)
  3. Configure o token (mesmo do config.lua)
  4. Selecione a pasta resources do MTA
  5. Clique em "Escanear Pasta"
  6. Clique em "Enviar pro Site"

Erros comuns:
  - 401: Token invalido
  - 404: URL incorreta ou endpoint nao existe
  - Timeout: Site offline ou firewall bloqueando
