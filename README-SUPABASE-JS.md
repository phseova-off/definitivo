# 🏭 Integração JavaScript Supabase - Tecnomonte

Integração completa em **Vanilla JavaScript** para conectar o sistema Tecnomonte ao Supabase, com suporte **offline-first** usando IndexedDB.

## 📋 Índice

- [Características](#características)
- [Arquivos](#arquivos)
- [Instalação](#instalação)
- [Configuração](#configuração)
- [Uso](#uso)
- [API Completa](#api-completa)
- [Modo Offline](#modo-offline)
- [Sincronização](#sincronização)

---

## ✨ Características

✅ **Offline-First**: Funciona sem internet usando IndexedDB  
✅ **Sincronização Automática**: Fila de sincronização com retry  
✅ **Cache Inteligente**: Todos os dados salvos localmente  
✅ **CRUD Completo**: Produtos, Movimentações, Colaboradores  
✅ **Detecção de Conectividade**: Online/Offline automático  
✅ **Zero Dependências**: Apenas Supabase JS Client  
✅ **TypeScript Ready**: Compatível com projeto React/TS existente  

---

## 📁 Arquivos

```
supabase-integration.js    # Integração principal
vanilla-example.html       # Exemplo de uso completo
README-SUPABASE-JS.md      # Esta documentação
```

---

## 🚀 Instalação

### Opção 1: Usar o Exemplo HTML (Standalone)

Basta abrir o arquivo `vanilla-example.html` no navegador:

```bash
# Abra diretamente ou use um servidor local
python -m http.server 8000
# Acesse: http://localhost:8000/vanilla-example.html
```

### Opção 2: Integrar no Projeto React Existente

Adicione o script no seu `index.html`:

```html
<!-- Supabase Client -->
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>

<!-- Integração Tecnomonte -->
<script src="/supabase-integration.js"></script>
```

---

## ⚙️ Configuração

### 1. Configurar Credenciais do Supabase

**Via LocalStorage** (recomendado para produção):

```javascript
localStorage.setItem('supabase_url', 'https://seu-projeto.supabase.co');
localStorage.setItem('supabase_anon_key', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...');
```

**Ou editando o arquivo** `supabase-integration.js`:

```javascript
const SUPABASE_CONFIG = {
  url: 'https://seu-projeto.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
};
```

### 2. Recarregar a Página

Após configurar, recarregue a página. O app inicializará automaticamente.

---

## 💡 Uso

### Inicialização Automática

O app inicializa automaticamente quando o DOM estiver pronto:

```javascript
// Já está no código - não precisa chamar manualmente
inicializarApp();
```

### Acessar a API Global

Todas as funções estão disponíveis no objeto global `TecnomonteApp`:

```javascript
// Exemplo: Listar produtos
const produtos = await TecnomonteApp.listarProdutos();
console.log(produtos);
```

---

## 📚 API Completa

### 🔐 Autenticação

#### `fazerLogin(usuario, senha)`
Realiza login no sistema (online ou offline).

```javascript
const result = await TecnomonteApp.fazerLogin('admin', 'senha123');

if (result.success) {
  console.log('Usuário logado:', result.user);
} else {
  console.error('Erro:', result.error);
}
```

**Retorno:**
```javascript
{
  success: true,
  user: {
    id: 'uuid',
    usuario: 'admin',
    nome: 'Administrador',
    nivel_acesso: 'administrador',
    ativo: true
  }
}
```

#### `fazerLogout()`
Desloga o usuário e limpa a sessão.

```javascript
await TecnomonteApp.fazerLogout();
```

---

### 📦 Produtos

#### `listarProdutos()`
Lista todos os produtos ativos.

```javascript
const produtos = await TecnomonteApp.listarProdutos();

console.log(produtos);
// [
//   {
//     id: 'uuid',
//     sku: 'PROD-0001',
//     nome: 'Capacete de Segurança',
//     categoria: 'EPIs',
//     quantidade: 50,
//     estoque_minimo: 10,
//     unidade_medida: 'UN',
//     localizacao: 'Prateleira A3',
//     ...
//   }
// ]
```

#### `adicionarProduto(produto)`
Adiciona um novo produto.

```javascript
const novoProduto = {
  nome: 'Luvas de Proteção',
  categoria: 'EPIs',
  unidade_medida: 'PAR',
  quantidade: 100,
  estoque_minimo: 20,
  localizacao: 'Prateleira B2',
  descricao: 'Luvas de látex tamanho G',
  preco_venda: 15.00
};

const result = await TecnomonteApp.adicionarProduto(novoProduto);

if (result.success) {
  console.log('Produto criado:', result.data);
}
```

#### `atualizarProduto(produto)`
Atualiza um produto existente.

```javascript
const produtoAtualizado = {
  id: 'uuid-do-produto',
  nome: 'Luvas de Proteção Premium',
  quantidade: 120,
  // ... outros campos
};

await TecnomonteApp.atualizarProduto(produtoAtualizado);
```

---

### 📋 Movimentações

#### `listarMovimentacoes(limit = 500)`
Lista as movimentações mais recentes.

```javascript
const movimentacoes = await TecnomonteApp.listarMovimentacoes(100);

console.log(movimentacoes);
// [
//   {
//     id: 'uuid',
//     tipo_movimentacao: 'entrada',
//     id_produto: 'uuid',
//     nome_material: 'Capacete',
//     quantidade: 10,
//     data: '2026-01-26T05:00:00Z',
//     nome_colaborador: 'João Silva',
//     ...
//   }
// ]
```

#### `adicionarMovimentacao(movimentacao)`
Registra uma nova movimentação.

```javascript
const novaMovimentacao = {
  tipo_movimentacao: 'saida',  // 'entrada', 'saida', 'devolucao_fornecedor'
  id_produto: 'uuid-do-produto',
  nome_material: 'Capacete de Segurança',
  quantidade: 5,
  data: new Date().toISOString(),
  id_colaborador: 'uuid-colaborador',
  nome_colaborador: 'João Silva',
  observacoes: 'Retirada para obra X'
};

const result = await TecnomonteApp.adicionarMovimentacao(novaMovimentacao);
```

**⚠️ Importante**: A movimentação atualiza automaticamente o estoque usando a função `atualizar_quantidade_estoque` do Supabase.

---

### 👥 Colaboradores

#### `listarColaboradores()`
Lista todos os colaboradores.

```javascript
const colaboradores = await TecnomonteApp.listarColaboradores();

console.log(colaboradores);
// [
//   {
//     id: 'uuid',
//     id_fun: 'FUN-001',
//     name: 'João Silva',
//     department: 'Manutenção',
//     status: 'Ativo'
//   }
// ]
```

#### `adicionarColaborador(colaborador)`
Adiciona um novo colaborador.

```javascript
const novoColaborador = {
  id_fun: 'FUN-042',
  name: 'Maria Santos',
  department: 'Almoxarifado',
  status: 'Ativo'
};

await TecnomonteApp.adicionarColaborador(novoColaborador);
```

---

### 📑 Categorias

#### `listarCategorias()`
Lista todas as categorias disponíveis.

```javascript
const categorias = await TecnomonteApp.listarCategorias();

console.log(categorias);
// ['EPIs', 'Ferramentas', 'Equipamentos', 'Consumíveis']
```

---

### 🔄 Sincronização

#### `sincronizarDados()`
Sincroniza dados offline com o Supabase.

```javascript
await TecnomonteApp.sincronizarDados();
```

**O que faz:**
1. Envia todas as operações da fila de sincronização
2. Recarrega os dados do servidor
3. Atualiza o cache local

**Chamada automática:**
- Quando a conexão é restaurada (evento `online`)
- A cada 5 minutos (se online)

---

### 📊 Estado da Aplicação

#### `usuarioLogado`
Usuário atualmente logado.

```javascript
const usuario = TecnomonteApp.usuarioLogado;
console.log(usuario.nome);  // 'Administrador'
```

#### `modoOffline`
Indica se está em modo offline.

```javascript
if (TecnomonteApp.modoOffline) {
  console.log('⚠️ Sem conexão - salvando localmente');
} else {
  console.log('🌐 Online - sincronizando com servidor');
}
```

---

## 🔌 Modo Offline

### Como Funciona

A integração usa **IndexedDB** para armazenar todos os dados localmente:

```
TecnoMonteDB
├── produtos
├── estoque
├── colaboradores
├── movimentacoes
├── fornecedores
├── categorias
├── usuarios
└── fila_sync (fila de sincronização)
```

### Comportamento Offline

Quando **SEM CONEXÃO**:
- ✅ Leitura de dados do cache local
- ✅ Criação/atualização salva na fila
- ✅ Login com credenciais em cache
- ❌ Exclusões não recomendadas

Quando **ONLINE NOVAMENTE**:
- 🔄 Sincronização automática da fila
- 📥 Download de dados atualizados
- 🔄 Cache atualizado

---

## 🔄 Sincronização

### Fila de Sincronização

Todas as operações offline são salvas em `fila_sync`:

```javascript
{
  id: 'sync_1737858174000',
  tipo: 'INSERT',
  tabela: 'produtos_master',
  dados: { /* objeto completo */ },
  timestamp: '2026-01-26T05:02:54.000Z',
  status: 'pendente'  // 'pendente', 'sincronizado', 'erro'
}
```

### Sincronização Manual

```javascript
// Forçar sincronização
await TecnomonteApp.sincronizarDados();
```

### Sincronização Automática

A sincronização acontece automaticamente:
- ✅ Quando a conexão é restaurada
- ✅ A cada 5 minutos (se online)
- ✅ Ao fazer login

---

## 🎯 Exemplos Práticos

### Exemplo 1: Adicionar Produto e Registrar Entrada

```javascript
// 1. Adicionar produto
const produto = await TecnomonteApp.adicionarProduto({
  nome: 'Martelo',
  categoria: 'Ferramentas',
  unidade_medida: 'UN',
  quantidade: 0,
  estoque_minimo: 5
});

// 2. Registrar entrada
await TecnomonteApp.adicionarMovimentacao({
  tipo_movimentacao: 'entrada',
  id_produto: produto.data.id,
  nome_material: 'Martelo',
  quantidade: 50,
  data: new Date().toISOString(),
  observacoes: 'Compra inicial'
});

// 3. Recarregar produtos para ver estoque atualizado
const produtosAtualizados = await TecnomonteApp.listarProdutos();
console.log(produtosAtualizados.find(p => p.id === produto.data.id));
// { ..., quantidade: 50 }
```

### Exemplo 2: Sistema de Retirada de EPI

```javascript
// Simular leitor de código de barras
async function retirarEPI(codigoEPI, idColaborador, quantidade) {
  // 1. Buscar produto
  const produtos = await TecnomonteApp.listarProdutos();
  const produto = produtos.find(p => 
    p.sku === codigoEPI || p.barcode === codigoEPI
  );
  
  if (!produto) {
    alert('Produto não encontrado!');
    return;
  }
  
  // 2. Verificar estoque
  if (produto.quantidade < quantidade) {
    alert('Estoque insuficiente!');
    return;
  }
  
  // 3. Buscar colaborador
  const colaboradores = await TecnomonteApp.listarColaboradores();
  const colaborador = colaboradores.find(c => c.id_fun === idColaborador);
  
  if (!colaborador) {
    alert('Colaborador não encontrado!');
    return;
  }
  
  // 4. Registrar saída
  const result = await TecnomonteApp.adicionarMovimentacao({
    tipo_movimentacao: 'saida',
    id_produto: produto.id,
    nome_material: produto.nome,
    quantidade: quantidade,
    data: new Date().toISOString(),
    id_colaborador: colaborador.id,
    nome_colaborador: colaborador.name,
    observacoes: `Retirada de ${quantidade} ${produto.unidade_medida}`
  });
  
  if (result.success) {
    alert(`✅ Retirada registrada com sucesso!\n${colaborador.name} retirou ${quantidade} ${produto.nome}`);
  }
}

// Uso
await retirarEPI('PROD-0001', 'FUN-042', 2);
```

### Exemplo 3: Dashboard de Estoque Baixo

```javascript
async function verificarEstoqueBaixo() {
  const produtos = await TecnomonteApp.listarProdutos();
  
  const produtosBaixos = produtos.filter(p => 
    p.quantidade <= p.estoque_minimo
  );
  
  if (produtosBaixos.length > 0) {
    console.warn('⚠️ Produtos com estoque baixo:');
    produtosBaixos.forEach(p => {
      console.warn(`  - ${p.nome}: ${p.quantidade}/${p.estoque_minimo}`);
    });
    
    return produtosBaixos;
  } else {
    console.log('✅ Todos os produtos com estoque adequado');
    return [];
  }
}

// Verificar a cada 10 minutos
setInterval(verificarEstoqueBaixo, 10 * 60 * 1000);
```

---

## 🛠️ Integração com React

Se você quiser usar esta integração no seu projeto React/TypeScript existente:

### 1. Criar um Hook

```typescript
// hooks/useSupabaseIntegration.ts
import { useEffect, useState } from 'react';

export function useSupabaseIntegration() {
  const [isOnline, setIsOnline] = useState(!window.TecnomonteApp?.modoOffline);
  const [currentUser, setCurrentUser] = useState(window.TecnomonteApp?.usuarioLogado);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setIsOnline(!window.TecnomonteApp?.modoOffline);
      setCurrentUser(window.TecnomonteApp?.usuarioLogado);
    }, 1000);
    
    return () => clearInterval(interval);
  }, []);
  
  return {
    isOnline,
    currentUser,
    api: window.TecnomonteApp
  };
}
```

### 2. Usar no Componente

```typescript
// components/ProductList.tsx
import { useEffect, useState } from 'react';
import { useSupabaseIntegration } from '../hooks/useSupabaseIntegration';

export function ProductList() {
  const { api, isOnline } = useSupabaseIntegration();
  const [products, setProducts] = useState([]);
  
  useEffect(() => {
    loadProducts();
  }, []);
  
  async function loadProducts() {
    const data = await api.listarProdutos();
    setProducts(data);
  }
  
  return (
    <div>
      <h2>Produtos {isOnline ? '🌐' : '⚠️'}</h2>
      {products.map(p => (
        <div key={p.id}>{p.nome} - {p.quantidade}</div>
      ))}
    </div>
  );
}
```

---

## 🧪 Testes

### Testar Modo Offline

1. Abra `vanilla-example.html`
2. Abra o DevTools (F12)
3. Vá em **Network** > **Throttling** > **Offline**
4. Tente adicionar um produto
5. Verifique o console: `⚠️ Sem conexão - trabalhando offline`
6. Restaure a conexão
7. Observe a sincronização automática

### Testar Sincronização

```javascript
// No console do navegador
const produtos = await TecnomonteApp.listarProdutos();
console.log('Produtos:', produtos.length);

// Adicionar offline
await navigator.onLine; // Verificar se está offline
const result = await TecnomonteApp.adicionarProduto({
  nome: 'Produto Teste',
  categoria: 'Teste',
  unidade_medida: 'UN'
});

// Sincronizar
await TecnomonteApp.sincronizarDados();
```

---

## 📝 Notas Importantes

### ⚠️ Limitações

- **Exclusões offline**: Não recomendadas (podem causar inconsistências)
- **IDs temporários**: Produtos offline recebem `temp_xxxx` até sincronizar
- **Conflitos**: Não há resolução automática de conflitos (last-write-wins)

### 🔒 Segurança

- **Senhas em texto plano**: ⚠️ O exemplo usa senhas não criptografadas
- **Para produção**: Implemente hash de senha (bcrypt, argon2) 
- **RLS policies**: Configure políticas RLS no Supabase
- **Anon Key**: Nunca exponha sua `service_role_key`

### 🚀 Performance

- **Cache**: Todos os dados ficam em cache local
- **Lazy loading**: Implemente paginação para grandes volumes
- **IndexedDB**: Limite de ~50MB por domínio (varia por navegador)

---

## 🤝 Contribuindo

Melhorias futuras:

- [ ] Resolução de conflitos
- [ ] Paginação automática
- [ ] Criptografia de dados offline
- [ ] Suporte a anexos/imagens
- [ ] Relatórios analíticos
- [ ] Export/Import de dados

---

## 📄 Licença

Este código é parte do sistema Tecnomonte.

---

## 📞 Suporte

Dúvidas? Entre em contato com a equipe de desenvolvimento.

**Criado com ❤️ para Tecnomonte**
