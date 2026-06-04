# MTA Store — Resource de Ativação

Resource Lua para MTA SA que recebe as ativações automáticas de itens comprados no site.

---

## Instalação

1. **Copie** a pasta `mta_resource/` para o diretório de resources do seu servidor MTA:
   ```
   mta-server/
   └── mods/
       └── deathmatch/
           └── resources/
               └── mta_store/     ← cole aqui
                   ├── meta.xml
                   ├── config.lua
                   ├── server.lua
                   ├── activate.lua
                   └── queue.json
   ```

2. **Configure o token** em `config.lua`:
   ```lua
   MTA_STORE_TOKEN = "seu-token-secreto-aqui"
   ```
   > Este token **deve ser idêntico** ao "API Token" configurado no painel Admin do site.

3. **Inicie o resource** no `mtaserver.conf` ou via console:
   ```
   start mta_store
   ```

---

## Configuração no Painel Admin do Site

Acesse **Admin → Configurações MTA** e preencha:

| Campo       | Valor                                    |
|-------------|------------------------------------------|
| Server URL  | `http://IP_DO_SEU_SERVIDOR_MTA`          |
| Server Port | `22005` (padrão MTA)                     |
| API Token   | O mesmo token em `config.lua`            |

O site enviará as ativações para:
```
http://IP:22005/mta_store/activate
```

---

## Comandos de Produto Suportados

| `mtaCommand`     | Parâmetros (`mtaParams`)             | Efeito                                      |
|------------------|--------------------------------------|---------------------------------------------|
| `giveVip`        | `{ days: N }`                        | Ativa VIP por N dias                        |
| `giveCar`        | `{ carId: N, tuning: true/false }`   | Spawna veículo e coloca o jogador dentro    |
| `giveVehicle`    | `{ vehicleId: N }`                   | Spawna veículo e coloca o jogador dentro    |
| `giveCoins`      | `{ amount: N }`                      | Adiciona N moedas (`elementData "coins"`)   |
| `giveSkin`       | `{ skinId: N }`                      | Troca a skin do jogador                     |
| `giveWeaponKit`  | `{ kit: "starter" \| "premium" }`    | Entrega kit de armas                        |
| `giveProperty`   | `{ propertyId: N }`                  | Atribui propriedade ao jogador              |

---

## Jogadores Offline

Quando o jogador **não está online** no momento da compra, o item é salvo em `queue.json`.  
Na próxima vez que o jogador fizer **login**, o script detecta os itens pendentes e os ativa automaticamente.

---

## Integração com seu sistema

Os handlers em `server.lua` usam `elementData` como exemplo.  
**Adapte as funções** para chamar exports do seu gamemode:

```lua
-- Exemplo: usar export do seu sistema de moedas
commandHandlers["giveCoins"] = function(player, params)
    local amount = params.amount or 0
    exports["meu_sistema_coins"]:addCoins(player, amount)
    colorMsg(player, "+R$" .. amount .. " adicionados!")
    return true, "OK"
end
```

---

## Segurança

- Toda requisição é verificada por **token** (`X-API-Token`)
- Opcionalmente verificada por **assinatura HMAC-SHA256** (`X-Signature`)
- O token nunca trafega em texto simples — ele gera a assinatura no lado do site
- Mantenha o `MTA_STORE_TOKEN` secreto e igual nos dois lados

---

## Debug

Habilite o modo debug em `config.lua` para ver logs detalhados:
```lua
MTA_STORE_DEBUG = true
```
Os logs aparecerão no **Debug Script** do MTA SA (F8 ou console).
