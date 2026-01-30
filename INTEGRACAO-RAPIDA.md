# 🔗 Guia Rápido de Integração

Como integrar o **supabase-integration.js** ao seu projeto React/TypeScript existente.

---

## 📋 Passo a Passo

### 1️⃣ Adicionar Script ao `index.html`

Edite [`index.html`](file:///c:/Users/paulo/OneDrive/Área%20de%20Trabalho/APP/almoxarifado-inteligente-ai%20(3)/index.html) e adicione antes do fechamento do `</body>`:

```html
<body>
  <div id="root"></div>
  
  <!-- Supabase Client CDN -->
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
  
  <!-- Integração Tecnomonte -->
  <script src="/supabase-integration.js"></script>
  
  <script type="module" src="/index.tsx"></script>
</body>
```

### 2️⃣ Configurar Credenciais

**Opção A**: Via localStorage (Console do navegador)

```javascript
localStorage.setItem('supabase_url', 'https://seu-projeto.supabase.co');
localStorage.setItem('supabase_anon_key', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...');
```

**Opção B**: Editar o arquivo [`supabase-integration.js`](file:///c:/Users/paulo/OneDrive/Área%20de%20Trabalho/APP/almoxarifado-inteligente-ai%20(3)/supabase-integration.js) (linha 7-10)

```javascript
const SUPABASE_CONFIG = {
  url: 'https://seu-projeto.supabase.co',
  anonKey: 'sua-anon-key-aqui',
};
```

### 3️⃣ Criar Hook React

Crie `hooks/useVanillaSupabase.ts`:

```typescript
import { useEffect, useState } from 'react';

export function useVanillaSupabase() {
  const [isReady, setIsReady] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    // Aguardar carregamento do script
    const checkReady = setInterval(() => {
      if (window.TecnomonteApp) {
        setIsReady(true);
        clearInterval(checkReady);
      }
    }, 100);

    return () => clearInterval(checkReady);
  }, []);

  useEffect(() => {
    if (!isReady) return;

    // Atualizar estado a cada segundo
    const interval = setInterval(() => {
      setIsOnline(!window.TecnomonteApp.modoOffline);
      setCurrentUser(window.TecnomonteApp.usuarioLogado);
    }, 1000);

    return () => clearInterval(interval);
  }, [isReady]);

  return {
    isReady,
    isOnline,
    currentUser,
    api: window.TecnomonteApp,
  };
}
```

### 4️⃣ Usar no Componente

Exemplo de uso em `App.tsx`:

```typescript
import { useVanillaSupabase } from './hooks/useVanillaSupabase';

function App() {
  const { isReady, isOnline, currentUser, api } = useVanillaSupabase();
  const [products, setProducts] = useState([]);

  useEffect(() => {
    if (isReady) {
      loadProducts();
    }
  }, [isReady]);

  async function loadProducts() {
    const data = await api.listarProdutos();
    setProducts(data);
  }

  if (!isReady) {
    return <div>Carregando integração...</div>;
  }

  return (
    <div>
      <header>
        <h1>Tecnomonte</h1>
        <div>
          {isOnline ? '🌐 Online' : '⚠️ Offline'}
          {currentUser && ` | ${currentUser.nome}`}
        </div>
      </header>

      <main>
        <button onClick={loadProducts}>Carregar Produtos</button>
        
        {products.map(p => (
          <div key={p.id}>
            {p.nome} - {p.quantidade} {p.unidade_medida}
          </div>
        ))}
      </main>
    </div>
  );
}
```

---

## 🎯 Casos de Uso

### Adicionar Produto

```typescript
async function handleAddProduct(formData: any) {
  const result = await window.TecnomonteApp.adicionarProduto({
    nome: formData.name,
    categoria: formData.category,
    unidade_medida: formData.unit,
    quantidade: formData.quantity,
    estoque_minimo: formData.minStock,
  });

  if (result.success) {
    toast.success('Produto adicionado!');
    loadProducts();
  } else {
    toast.error(result.error);
  }
}
```

### Registrar Movimentação

```typescript
async function handleTransaction(productId: string, quantity: number, type: string) {
  const result = await window.TecnomonteApp.adicionarMovimentacao({
    tipo_movimentacao: type,
    id_produto: productId,
    nome_material: product.nome,
    quantidade: quantity,
    data: new Date().toISOString(),
  });

  if (result.success) {
    toast.success('Movimentação registrada!');
  }
}
```

### Login

```typescript
async function handleLogin(username: string, password: string) {
  const result = await window.TecnomonteApp.fazerLogin(username, password);

  if (result.success) {
    setUser(result.user);
    navigate('/dashboard');
  } else {
    toast.error(result.error);
  }
}
```

---

## 🔀 Convivência com `supabaseService.ts`

Você pode usar **ambos** simultaneamente:

### Estratégia 1: Migração Gradual

```typescript
// Usar o novo para novas features
const produtos = await window.TecnomonteApp.listarProdutos();

// Manter o antigo para features existentes
const stats = await supabaseService.getDashboardStats();
```

### Estratégia 2: Wrapper Unificado

```typescript
// services/unifiedService.ts
export const unifiedService = {
  // Usar integração JS
  listProducts: () => window.TecnomonteApp.listarProdutos(),
  addTransaction: (tx) => window.TecnomonteApp.adicionarMovimentacao(tx),
  
  // Manter TS service para features avançadas
  getDashboardStats: () => supabaseService.getDashboardStats(),
  listAuditLogs: () => supabaseService.listAuditLogs(),
};
```

---

## ✅ Vantagens da Integração JS

| Recurso | TS Service | JS Integration |
|---------|-----------|----------------|
| **Offline First** | ❌ Parcial | ✅ Completo |
| **Auto-Sync** | ❌ Manual | ✅ Automático |
| **IndexedDB** | ❌ Não | ✅ Sim |
| **Fila de Sync** | ⚠️ LocalStorage | ✅ IndexedDB |
| **Tipagem** | ✅ TypeScript | ⚠️ Declarações |
| **Modular** | ✅ Classes | ⚠️ Global |
| **React Native** | ✅ Sim | ❌ Não |

---

## 🧪 Testar Integração

### 1. Iniciar Dev Server

```bash
npm run dev
```

### 2. Abrir Console do Navegador

```javascript
// Verificar se carregou
console.log(window.TecnomonteApp);

// Testar offline
const produtos = await TecnomonteApp.listarProdutos();
console.log(produtos);
```

### 3. Testar Modo Offline

1. Network Tab > Throttling > **Offline**
2. Adicionar produto
3. Ver fila: `TecnomonteApp.sincronizarDados()`
4. Restaurar conexão
5. Ver sincronização automática

---

## 🚨 Troubleshooting

### Erro: "TecnomonteApp is not defined"

**Causa**: Script carregou depois do React

**Solução**: Adicionar check no hook

```typescript
useEffect(() => {
  const checkReady = setInterval(() => {
    if (window.TecnomonteApp) {
      setIsReady(true);
      clearInterval(checkReady);
    }
  }, 100);
}, []);
```

### Erro: TypeScript não reconhece `window.TecnomonteApp`

**Causa**: Falta o arquivo de declarações

**Solução**: Importar o tipo

```typescript
// No topo do arquivo
import '../supabase-integration.d.ts';
```

### IndexedDB não inicializa

**Causa**: Modo privado/incognito do navegador

**Solução**: Usar navegador no modo normal

---

## 📚 Próximos Passos

1. ✅ Configurar credenciais
2. ✅ Criar hook React
3. ✅ Testar lista de produtos
4. [ ] Migrar features críticas
5. [ ] Implementar UI de sincronização
6. [ ] Adicionar indicador offline
7. [ ] Testar em produção

---

## 🔗 Links Úteis

- [README Principal](./README-SUPABASE-JS.md) - Documentação completa
- [Exemplo HTML](./vanilla-example.html) - Demo standalone
- [API Reference](./README-SUPABASE-JS.md#api-completa) - Todas as funções

---

**Dúvidas?** Consulte a [documentação completa](./README-SUPABASE-JS.md) ou abra uma issue.
