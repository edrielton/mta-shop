require('dotenv/config');

const TOKEN = '988CBCDD5B9CE9C19EBBE1268A151294';
const BASE = 'http://localhost:5000';

const testPayload = {
  source: 'scanner_app_v4',
  trigger: 'MTA Scanner App (Teste)',
  total: 5,
  scannedAt: Math.floor(Date.now() / 1000),
  resources: [
    {
      name: 'vrp_vip',
      description: 'Sistema de VIP para o servidor',
      author: 'DevTeam',
      version: '2.1',
      category: 'vip',
      commands: ['darvip', 'removervip', 'checkvip'],
      sellable: [
        {
          suggestedName: 'VIP Gold',
          suggestedDesc: 'VIP Gold - beneficios exclusivos no servidor.',
          category: 'vip',
          mtaCommand: 'giveVip',
          mtaParams: { tier: 'gold', days: 30, resource: 'vrp_vip' },
          autoDetected: true,
          resourceName: 'vrp_vip',
          luaCommands: ['darvip', 'checkvip'],
          estimatedPrice: 29.90,
        },
        {
          suggestedName: 'VIP Diamond',
          suggestedDesc: 'VIP Diamond - beneficios exclusivos no servidor.',
          category: 'vip',
          mtaCommand: 'giveVip',
          mtaParams: { tier: 'diamond', days: 30, resource: 'vrp_vip' },
          autoDetected: true,
          resourceName: 'vrp_vip',
          luaCommands: ['darvip', 'checkvip'],
          estimatedPrice: 79.90,
        },
      ],
      luaFileCount: 4,
    },
    {
      name: 'vehicle_system',
      description: 'Sistema de veiculos do servidor',
      author: 'CarDev',
      version: '1.5',
      category: 'vehicle',
      commands: ['darveiculo', 'removerveiculo'],
      sellable: [
        {
          suggestedName: 'Veiculo Premium - vehicle_system',
          suggestedDesc: 'Veiculo Premium entregue no spawn.',
          category: 'vehicle',
          mtaCommand: 'giveVehicle',
          mtaParams: { resource: 'vehicle_system', tier: 'premium' },
          autoDetected: false,
          resourceName: 'vehicle_system',
          luaCommands: ['darveiculo'],
          estimatedPrice: 35.00,
        },
      ],
      luaFileCount: 3,
    },
    {
      name: ' economy ',
      description: 'Sistema de economia e moedas',
      author: 'EconDev',
      version: '3.0',
      category: 'coins',
      commands: ['darmoedas', 'pagar'],
      sellable: [
        {
          suggestedName: '5.000 Moedas',
          suggestedDesc: 'Pacote de 5.000 moedas.',
          category: 'coins',
          mtaCommand: 'giveCoins',
          mtaParams: { amount: 5000, resource: 'economy' },
          autoDetected: false,
          resourceName: 'economy',
          luaCommands: ['darmoedas'],
          estimatedPrice: 15.00,
        },
        {
          suggestedName: '15.000 Moedas',
          suggestedDesc: 'Pacote de 15.000 moedas.',
          category: 'coins',
          mtaCommand: 'giveCoins',
          mtaParams: { amount: 15000, resource: 'economy' },
          autoDetected: false,
          resourceName: 'economy',
          luaCommands: ['darmoedas'],
          estimatedPrice: 30.00,
        },
      ],
      luaFileCount: 2,
    },
  ],
  detected: [
    {
      resourceName: 'vrp_vip',
      suggestedName: 'VIP Gold',
      suggestedDesc: 'VIP Gold - beneficios exclusivos no servidor.',
      category: 'vip',
      mtaCommand: 'giveVip',
      mtaParams: { tier: 'gold', days: 30, resource: 'vrp_vip' },
      autoDetected: true,
      luaCommands: ['darvip', 'checkvip'],
      estimatedPrice: 29.90,
    },
    {
      resourceName: 'vrp_vip',
      suggestedName: 'VIP Diamond',
      suggestedDesc: 'VIP Diamond - beneficios exclusivos no servidor.',
      category: 'vip',
      mtaCommand: 'giveVip',
      mtaParams: { tier: 'diamond', days: 30, resource: 'vrp_vip' },
      autoDetected: true,
      luaCommands: ['darvip', 'checkvip'],
      estimatedPrice: 79.90,
    },
    {
      resourceName: 'vehicle_system',
      suggestedName: 'Veiculo Premium - vehicle_system',
      suggestedDesc: 'Veiculo Premium entregue no spawn.',
      category: 'vehicle',
      mtaCommand: 'giveVehicle',
      mtaParams: { resource: 'vehicle_system', tier: 'premium' },
      autoDetected: false,
      luaCommands: ['darveiculo'],
      estimatedPrice: 35.00,
    },
    {
      resourceName: 'economy',
      suggestedName: '5.000 Moedas',
      suggestedDesc: 'Pacote de 5.000 moedas.',
      category: 'coins',
      mtaCommand: 'giveCoins',
      mtaParams: { amount: 5000, resource: 'economy' },
      autoDetected: false,
      luaCommands: ['darmoedas'],
      estimatedPrice: 15.00,
    },
    {
      resourceName: 'economy',
      suggestedName: '15.000 Moedas',
      suggestedDesc: 'Pacote de 15.000 moedas.',
      category: 'coins',
      mtaCommand: 'giveCoins',
      mtaParams: { amount: 15000, resource: 'economy' },
      autoDetected: false,
      luaCommands: ['darmoedas'],
      estimatedPrice: 30.00,
    },
  ],
};

async function runTest() {
  console.log('=== TESTE 1: Enviar scan via POST /api/mta/sync ===\n');
  console.log('Payload:');
  console.log('  - 3 resources (vrp_vip, vehicle_system, economy)');
  console.log('  - 5 itens detectados (2 VIP, 1 veiculo, 2 moedas)');
  console.log('  - Total estimated: R$189.80\n');

  try {
    const res = await fetch(`${BASE}/api/mta/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Token': TOKEN,
      },
      body: JSON.stringify(testPayload),
    });
    const data = await res.json();
    console.log(`Status: ${res.status}`);
    console.log(`Resposta: ${JSON.stringify(data, null, 2)}\n`);

    if (res.status === 200 && data.success) {
      console.log('✅ Scan enviado com sucesso!\n');
    } else {
      console.log('❌ Falha no envio\n');
      return;
    }
  } catch (e) {
    console.log(`❌ Erro de conexao: ${e.message}`);
    console.log('Verifique se o servidor esta rodando em http://localhost:5000\n');
    return;
  }

  console.log('=== TESTE 2: Buscar dados via GET /api/scan-data ===\n');
  try {
    const res = await fetch(`${BASE}/api/scan-data`);
    const data = await res.json();
    console.log(`Status: ${res.status}`);
    console.log(`success: ${data.success}`);
    console.log(`totalResources: ${data.total}`);
    console.log(`detectedItems: ${data.detectedItems}`);
    console.log(`trigger: ${data.trigger}`);
    console.log(`resources: ${data.resources?.length || 0} items`);
    console.log(`detected: ${data.detected?.length || 0} items\n`);

    if (data.detected && data.detected.length > 0) {
      console.log('Itens detectados:');
      data.detected.forEach((item, i) => {
        const price = item.estimatedPrice ? `R$${item.estimatedPrice.toFixed(2)}` : '—';
        console.log(`  ${i+1}. [${item.category.toUpperCase()}] ${item.suggestedName}`);
        console.log(`     Resource: ${item.resourceName} | Cmd: ${item.mtaCommand} | Preco: ${price}`);
      });
      console.log('');
      console.log('✅ Dados retornados corretamente!\n');
    } else {
      console.log('❌ Nenhum dado retornado\n');
    }
  } catch (e) {
    console.log(`❌ Erro: ${e.message}\n`);
  }

  console.log('=== TESTE 3: Verificar no banco de dados ===\n');
  const { Pool } = require('pg');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  try {
    const result = await pool.query('SELECT id, source, trigger, total_resources, detected_items, scanned_at, created_at FROM scanner_data ORDER BY created_at DESC LIMIT 1');
    if (result.rows.length > 0) {
      const row = result.rows[0];
      console.log(`ID: ${row.id}`);
      console.log(`Source: ${row.source}`);
      console.log(`Trigger: ${row.trigger}`);
      console.log(`Total Resources: ${row.total_resources}`);
      console.log(`Detected Items: ${row.detected_items}`);
      console.log(`Scanned At: ${row.scanned_at}`);
      console.log(`Created At: ${row.created_at}`);
      console.log('');
      console.log('✅ Dados salvos no banco!\n');
    } else {
      console.log('❌ Nenhum registro encontrado no banco\n');
    }

    const countResult = await pool.query('SELECT COUNT(*) as count FROM scanner_data');
    console.log(`Total de registros na tabela scanner_data: ${countResult.rows[0].count}`);
  } catch (e) {
    console.log(`❌ Erro ao consultar banco: ${e.message}\n`);
  } finally {
    await pool.end();
  }

  console.log('=== TESTES CONCLUIDOS ===');
}

runTest();
