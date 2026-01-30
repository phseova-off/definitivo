// =====================================================
// INTEGRAÇÃO SUPABASE - TECNOMONTE
// Schemas 2 e 3 da conversa "testing"
// =====================================================

// Configuração Supabase
const SUPABASE_CONFIG = {
    // Tenta pegar do localStorage, senão usa os valores padrão do projeto
    url: import.meta.env.VITE_SUPABASE_URL || localStorage.getItem('supabase_url'),
    anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || localStorage.getItem('supabase_anon_key'),
};

let supabase = null;
let usuarioLogado = null;
let modoOffline = false;

// Cache local para busca rápida e offline
let dados_cache = {
    movimentacoes: [],
    produtos: [],
    colaboradores: [],
    categorias: []
};

function salvarCache() {
    try {
        localStorage.setItem('tecnomonte_cache', JSON.stringify(dados_cache));
    } catch (e) {
        console.error('Erro ao salvar cache no localStorage:', e);
    }
}

// Base de dados IndexedDB para cache offline
const DB_NAME = 'TecnoMonteDB';
const DB_VERSION = 1;
let db = null;

// =====================================================
// INICIALIZAÇÃO
// =====================================================

function inicializarSupabase() {
    if (SUPABASE_CONFIG.url && SUPABASE_CONFIG.anonKey) {
        try {
            supabase = window.supabase.createClient(
                SUPABASE_CONFIG.url,
                SUPABASE_CONFIG.anonKey,
                {
                    auth: {
                        persistSession: true,
                        autoRefreshToken: true,
                        detectSessionInUrl: true,
                    },
                    db: {
                        schema: 'public',
                    },
                }
            );

            console.log('✅ Supabase inicializado');
            modoOffline = false;
            return true;
        } catch (error) {
            console.error('❌ Erro ao inicializar Supabase:', error);
            modoOffline = true;
            return false;
        }
    }

    console.warn('⚠️ Supabase não configurado - usando modo offline');
    modoOffline = true;
    return false;
}

async function inicializarIndexedDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(request.error);

        request.onsuccess = () => {
            db = request.result;
            console.log('✅ IndexedDB inicializado');
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            const db = event.target.result;

            // Criar object stores
            const stores = {
                'produtos': {
                    keyPath: 'id', indexes: [
                        { name: 'sku', keyPath: 'sku', unique: true },
                        { name: 'categoria', keyPath: 'categoria', unique: false },
                        { name: 'tag', keyPath: 'tag', unique: false },
                    ]
                },
                'estoque': {
                    keyPath: 'id', indexes: [
                        { name: 'id_produto', keyPath: 'id_produto', unique: false },
                        { name: 'sku', keyPath: 'sku', unique: false },
                    ]
                },
                'colaboradores': {
                    keyPath: 'id', indexes: [
                        { name: 'id_fun', keyPath: 'id_fun', unique: true },
                        { name: 'status', keyPath: 'status', unique: false },
                    ]
                },
                'movimentacoes': {
                    keyPath: 'id', indexes: [
                        { name: 'data', keyPath: 'data', unique: false },
                        { name: 'id_produto', keyPath: 'id_produto', unique: false },
                        { name: 'id_colaborador', keyPath: 'id_colaborador', unique: false },
                    ]
                },
                'fornecedores': {
                    keyPath: 'id', indexes: [
                        { name: 'cnpj', keyPath: 'cnpj', unique: true },
                    ]
                },
                'categorias': { keyPath: 'id', indexes: [] },
                'usuarios': {
                    keyPath: 'id', indexes: [
                        { name: 'usuario', keyPath: 'usuario', unique: true },
                    ]
                },
                'fila_sync': {
                    keyPath: 'id', indexes: [
                        { name: 'status', keyPath: 'status', unique: false },
                    ]
                },
            };

            // Criar stores e índices
            Object.entries(stores).forEach(([storeName, config]) => {
                if (!db.objectStoreNames.contains(storeName)) {
                    const store = db.createObjectStore(storeName, { keyPath: config.keyPath });

                    // Criar índices
                    config.indexes.forEach(index => {
                        store.createIndex(index.name, index.keyPath, { unique: index.unique });
                    });
                }
            });

            console.log('✅ Object stores criados');
        };
    });
}

async function inicializarApp() {
    try {
        console.log('🚀 Inicializando Tecnomonte App...');

        // 1. IndexedDB (offline first)
        await inicializarIndexedDB();

        // 2. Supabase
        const supabaseOk = inicializarSupabase();

        // 3. Verificar sessão
        if (supabaseOk) {
            await verificarSessaoAtiva();
        } else {
            // Tentar sessão local
            const sessaoLocal = localStorage.getItem('sessao_usuario');
            if (sessaoLocal) {
                usuarioLogado = JSON.parse(sessaoLocal);
                await carregarDadosCache();
                renderizarApp();
            } else {
                mostrarTelaLogin();
            }
        }

        // 4. Configurar listeners
        configurarEventListeners();

    } catch (error) {
        console.error('❌ Erro fatal na inicialização:', error);
        alert('Erro ao inicializar aplicativo. Verifique o console.');
    }
}

async function verificarSessaoAtiva() {
    try {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) throw error;

        if (session) {
            // Buscar dados do usuário
            const { data: userData, error: userError } = await supabase
                .from('usuarios')
                .select('*')
                .eq('id', session.user.id)
                .single();

            if (userError) throw userError;

            if (userData && userData.ativo) {
                usuarioLogado = userData;
                localStorage.setItem('sessao_usuario', JSON.stringify(userData));

                // Carregar dados iniciais
                await carregarDadosIniciais();

                // Sincronizar se houver fila
                await sincronizarDados();

                renderizarApp();
                return;
            }
        }

        mostrarTelaLogin();

    } catch (error) {
        console.error('Erro ao verificar sessão:', error);
        mostrarTelaLogin();
    }
}

function configurarEventListeners() {
    // Detectar online/offline
    window.addEventListener('online', async () => {
        console.log('🌐 Conexão restaurada');
        modoOffline = false;
        mostrarNotificacao('Conexão restaurada - sincronizando dados...', 'info');
        await sincronizarDados();
    });

    window.addEventListener('offline', () => {
        console.log('⚠️ Sem conexão - modo offline');
        modoOffline = true;
        mostrarNotificacao('Sem conexão - trabalhando offline', 'warning');
    });

    // Auto-sincronizar a cada 5 minutos
    setInterval(async () => {
        if (!modoOffline && navigator.onLine) {
            await sincronizarDados();
        }
    }, 5 * 60 * 1000);
}

// =====================================================
// AUTENTICAÇÃO
// =====================================================

async function fazerLogin(usuario, senha) {
    if (modoOffline) {
        // Login offline básico (validar com cache)
        const usuariosCache = await obterDadosIndexedDB('usuarios');
        const user = usuariosCache.find(u => u.usuario === usuario && u.senha === senha);

        if (user && user.ativo) {
            usuarioLogado = user;
            localStorage.setItem('sessao_usuario', JSON.stringify(user));
            await carregarDadosCache();
            return { success: true, user };
        }

        return { success: false, error: 'Credenciais inválidas ou usuário inativo' };
    }

    try {
        // Login com Supabase
        const { data, error } = await supabase
            .from('usuarios')
            .select('*')
            .eq('usuario', usuario)
            .eq('senha', senha)
            .eq('ativo', true)
            .single();

        if (error || !data) {
            return { success: false, error: 'Credenciais inválidas ou usuário inativo' };
        }

        usuarioLogado = data;
        localStorage.setItem('sessao_usuario', JSON.stringify(data));

        // Carregar dados iniciais
        await carregarDadosIniciais();

        return { success: true, user: data };

    } catch (error) {
        console.error('Erro no login:', error);
        return { success: false, error: 'Erro ao fazer login' };
    }
}

async function fazerLogout() {
    usuarioLogado = null;
    localStorage.removeItem('sessao_usuario');

    if (!modoOffline && supabase) {
        await supabase.auth.signOut();
    }

    mostrarTelaLogin();
}

// =====================================================
// CARREGAMENTO DE DADOS
// =====================================================

async function carregarDadosIniciais() {
    console.log('📦 Carregando dados iniciais...');

    try {
        const [produtos, colaboradores, categorias, movimentacoes] = await Promise.all([
            listarProdutos(),
            listarColaboradores(),
            listarCategorias(),
            listarMovimentacoes(500)
        ]);

        // Salvar no IndexedDB
        await salvarNoIndexedDB('produtos', produtos);
        await salvarNoIndexedDB('colaboradores', colaboradores);
        await salvarNoIndexedDB('categorias', categorias);
        await salvarNoIndexedDB('movimentacoes', movimentacoes);

        // Atualizar cache local
        dados_cache.produtos = produtos;
        dados_cache.colaboradores = colaboradores;
        dados_cache.categorias = categorias;
        dados_cache.movimentacoes = movimentacoes;
        salvarCache();

        console.log('✅ Dados iniciais carregados');

    } catch (error) {
        console.error('❌ Erro ao carregar dados iniciais:', error);
        // Usar dados do cache se houver erro
        await carregarDadosCache();
    }
}

async function carregarDadosCache() {
    console.log('📦 Carregando dados do cache...');
    try {
        // Tentar carregar do localStorage primeiro
        const saved = localStorage.getItem('tecnomonte_cache');
        if (saved) {
            dados_cache = JSON.parse(saved);
        } else {
            // Se não houver no localStorage, carregar do IndexedDB
            const [produtos, colaboradores, movimentacoes] = await Promise.all([
                buscarDaIndexedDB('produtos'),
                buscarDaIndexedDB('colaboradores'),
                buscarDaIndexedDB('movimentacoes')
            ]);
            dados_cache.produtos = produtos;
            dados_cache.colaboradores = colaboradores;
            dados_cache.movimentacoes = movimentacoes;
        }
    } catch (e) {
        console.error('Erro ao carregar dados do cache:', e);
    }
}

// =====================================================
// PRODUTOS
// =====================================================

async function buscarProdutos(filtros = {}) {
    try {
        if (modoOffline || !supabase) {
            return await buscarProdutosCache(filtros);
        }

        let query = supabase
            .from('produtos_master')
            .select(`
        *,
        estoque:estoque_atual!id_produto(*),
        fornecedor:fornecedores!fornecedor_principal_id(*)
      `)
            .eq('status', 'Ativo');

        // Filtros
        if (filtros.categoria) {
            query = query.eq('categoria', filtros.categoria);
        }

        if (filtros.busca) {
            query = query.or(`nome.ilike.%${filtros.busca}%,sku.ilike.%${filtros.busca}%,codigo_barras.ilike.%${filtros.busca}%`);
        }

        if (filtros.tag) {
            query = query.eq('tag', filtros.tag);
        }

        const { data, error } = await query.order('nome');

        if (error) throw error;

        // Salvar cache
        await salvarNoIndexedDB('produtos', data);

        return data;

    } catch (error) {
        console.error('Erro ao buscar produtos:', error);
        return await buscarProdutosCache(filtros);
    }
}

async function buscarProdutoPorId(id) {
    try {
        if (modoOffline || !supabase) {
            const produtos = await buscarDaIndexedDB('produtos');
            return produtos.find(p => p.id === id);
        }

        const { data, error } = await supabase
            .from('produtos_master')
            .select(`
        *,
        estoque:estoque_atual!id_produto(*),
        fornecedor:fornecedores!fornecedor_principal_id(*)
      `)
            .eq('id', id)
            .single();

        if (error) throw error;

        return data;

    } catch (error) {
        console.error('Erro ao buscar produto:', error);
        throw error;
    }
}

async function buscarProdutoPorSku(sku) {
    try {
        if (modoOffline || !supabase) {
            const produtos = await buscarDaIndexedDB('produtos');
            return produtos.find(p => p.sku === sku);
        }

        const { data, error } = await supabase
            .from('produtos_master')
            .select(`
        *,
        estoque:estoque_atual!id_produto(*)
      `)
            .eq('sku', sku)
            .single();

        if (error) throw error;

        return data;

    } catch (error) {
        console.error('Erro ao buscar produto por SKU:', error);
        return null;
    }
}

async function buscarProdutoPorCodigoBarras(codigo) {
    try {
        if (modoOffline || !supabase) {
            const produtos = await buscarDaIndexedDB('produtos');
            return produtos.find(p => p.codigo_barras === codigo);
        }

        const { data, error } = await supabase
            .from('produtos_master')
            .select(`
        *,
        estoque:estoque_atual!id_produto(*)
      `)
            .eq('codigo_barras', codigo)
            .single();

        if (error) throw error;

        return data;

    } catch (error) {
        console.error('Erro ao buscar produto por código de barras:', error);
        return null;
    }
}

async function buscarProdutoPorTag(tag) {
    try {
        if (modoOffline || !supabase) {
            const produtos = await buscarDaIndexedDB('produtos');
            return produtos.find(p => p.tag && p.tag.toUpperCase() === tag.toUpperCase());
        }

        const { data, error } = await supabase
            .from('produtos_master')
            .select(`
        *,
        estoque:estoque_atual!id_produto(*)
      `)
            .ilike('tag', tag)
            .single();

        if (error) throw error;

        return data;

    } catch (error) {
        console.error('Erro ao buscar produto por TAG:', error);
        return null;
    }
}

async function criarProduto(dadosProduto) {
    try {
        // Gerar SKU
        const sku = await gerarProximoSku();

        const produto = {
            sku: sku,
            nome: dadosProduto.nome,
            descricao: dadosProduto.descricao || null,
            categoria: dadosProduto.categoria,
            subcategoria: dadosProduto.subcategoria || null,
            unidade_medida: dadosProduto.unidade_medida || 'un',
            codigo_barras: dadosProduto.codigo_barras || null,
            tag: dadosProduto.tag ? dadosProduto.tag.toUpperCase() : null,
            empresa_locadora: dadosProduto.empresa_locadora || null,
            valor_unitario: parseFloat(dadosProduto.valor_unitario || 0),
            valor_locacao: parseFloat(dadosProduto.valor_locacao || 0),
            ncm: dadosProduto.ncm || null,
            fornecedor_principal_id: dadosProduto.fornecedor_principal_id || null,
            localizacao: dadosProduto.localizacao || null,
            status: 'Ativo',
            criado_por: usuarioLogado?.id,
            app_origem: 'almoxarifado',
        };

        if (modoOffline || !supabase) {
            return await criarProdutoOffline(produto, dadosProduto);
        }

        // Verificar TAG duplicado
        if (produto.tag) {
            const tagExistente = await buscarProdutoPorTag(produto.tag);
            if (tagExistente) {
                throw new Error(`TAG ${produto.tag} já cadastrado no produto: ${tagExistente.nome} (SKU: ${tagExistente.sku})`);
            }
        }

        // Inserir produto
        const { data: produtoData, error: produtoError } = await supabase
            .from('produtos_master')
            .insert(produto)
            .select()
            .single();

        if (produtoError) throw produtoError;

        // Criar registro de estoque
        const estoque = {
            id_produto: produtoData.id,
            sku: produtoData.sku,
            quantidade: parseFloat(dadosProduto.quantidade_inicial || 0),
            quantidade_reservada: 0,
            estoque_minimo: parseFloat(dadosProduto.estoque_minimo || 0),
            estoque_maximo: parseFloat(dadosProduto.estoque_maximo || 0),
            lote: dadosProduto.lote || null,
            validade: dadosProduto.validade || null,
            localizacao_fisica: dadosProduto.localizacao_fisica || null,
            status_estoque: 'Disponível',
        };

        const { error: estoqueError } = await supabase
            .from('estoque_atual')
            .insert(estoque);

        if (estoqueError) {
            // Rollback do produto se estoque falhar
            await supabase.from('produtos_master').delete().eq('id', produtoData.id);
            throw estoqueError;
        }

        // Registrar entrada inicial se quantidade > 0
        if (estoque.quantidade > 0) {
            await registrarMovimentacao({
                tipo_movimentacao: 'Entrada',
                id_produto: produtoData.id,
                sku_material: produtoData.sku,
                nome_material: produtoData.nome,
                categoria: produtoData.categoria,
                tag: produtoData.tag,
                quantidade: estoque.quantidade,
                quantidade_anterior: 0,
                quantidade_atual: estoque.quantidade,
                unidade: produtoData.unidade_medida,
                valor_unitario: produtoData.valor_unitario,
                motivo: 'Cadastro inicial do produto',
                metodo_registro: 'manual',
            });
        }

        // Registrar log
        await registrarLog('Criar', 'produtos_master', produtoData.id, null, produtoData);

        // Atualizar cache
        const produtoCompleto = { ...produtoData, estoque: [estoque] };
        await salvarNoIndexedDB('produtos', [produtoCompleto]);

        mostrarNotificacao(`Produto ${produtoData.nome} cadastrado com sucesso!`, 'success');

        return produtoCompleto;

    } catch (error) {
        console.error('Erro ao criar produto:', error);

        if (modoOffline) {
            return await criarProdutoOffline(produto, dadosProduto);
        }

        throw error;
    }
}

async function atualizarProduto(id, dadosAtualizados) {
    try {
        if (modoOffline || !supabase) {
            return await atualizarProdutoOffline(id, dadosAtualizados);
        }

        // Buscar dados anteriores
        const { data: dadosAnteriores } = await supabase
            .from('produtos_master')
            .select('*')
            .eq('id', id)
            .single();

        // Preparar atualização
        const atualizacao = { ...dadosAtualizados };

        // Converter TAG para uppercase se fornecido
        if (atualizacao.tag) {
            atualizacao.tag = atualizacao.tag.toUpperCase();

            // Verificar duplicidade
            const tagExistente = await buscarProdutoPorTag(atualizacao.tag);
            if (tagExistente && tagExistente.id !== id) {
                throw new Error(`TAG ${atualizacao.tag} já está em uso por: ${tagExistente.nome}`);
            }
        }

        // Atualizar
        const { data, error } = await supabase
            .from('produtos_master')
            .update(atualizacao)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        // Registrar log
        await registrarLog('Editar', 'produtos_master', id, dadosAnteriores, data);

        mostrarNotificacao('Produto atualizado!', 'success');

        return data;

    } catch (error) {
        console.error('Erro ao atualizar produto:', error);
        throw error;
    }
}

async function deletarProduto(id) {
    try {
        if (modoOffline || !supabase) {
            throw new Error('Exclusão não disponível offline');
        }

        // Verificar se tem movimentações
        const { data: movimentacoes } = await supabase
            .from('movimentacoes')
            .select('id')
            .eq('id_produto', id)
            .limit(1);

        if (movimentacoes && movimentacoes.length > 0) {
            throw new Error('Não é possível excluir produto com movimentações. Desative-o ao invés de excluir.');
        }

        // Buscar dados para log
        const { data: produtoData } = await supabase
            .from('produtos_master')
            .select('*')
            .eq('id', id)
            .single();

        // Deletar (cascade vai deletar estoque)
        const { error } = await supabase
            .from('produtos_master')
            .delete()
            .eq('id', id);

        if (error) throw error;

        // Registrar log
        await registrarLog('Deletar', 'produtos_master', id, produtoData, null);

        mostrarNotificacao('Produto excluído!', 'success');

        return true;

    } catch (error) {
        console.error('Erro ao deletar produto:', error);
        throw error;
    }
}

async function inativarProduto(id) {
    try {
        return await atualizarProduto(id, { status: 'Inativo' });
    } catch (error) {
        console.error('Erro ao inativar produto:', error);
        throw error;
    }
}

// =====================================================
// MOVIMENTAÇÕES
// =====================================================

/**
 * Criar nova movimentação (Entrada, Saída, Devolução, etc)
 */
async function criarMovimentacao(dados) {
    try {
        // Validar dados obrigatórios
        if (!dados.tipo_movimentacao || !dados.id_produto || !dados.quantidade) {
            throw new Error('Dados obrigatórios faltando');
        }

        // Buscar produto para pegar informações
        const { data: produto } = await supabase
            .from('produtos_master')
            .select('*, estoque:estoque_atual(*)')
            .eq('id', dados.id_produto)
            .single();

        if (!produto) {
            throw new Error('Produto não encontrado');
        }

        // Gerar código de movimentação
        const codigo = await gerarCodigoMovimentacao();

        // Calcular quantidades
        const quantidade_anterior = produto.estoque?.[0]?.quantidade || 0;
        let quantidade_atual = quantidade_anterior;

        const tipo = dados.tipo_movimentacao.toLowerCase();
        if (tipo === 'entrada' || tipo === 'devolução' || tipo === 'devolucao') {
            quantidade_atual += parseFloat(dados.quantidade);
        } else if (tipo === 'saída' || tipo === 'saida') {
            quantidade_atual -= parseFloat(dados.quantidade);

            // Validar estoque suficiente
            if (quantidade_atual < 0) {
                throw new Error('Estoque insuficiente para esta saída');
            }
        }

        // Preparar dados da movimentação
        const movimentacao = {
            codigo_movimentacao: codigo,
            data: dados.data || new Date().toISOString().split('T')[0],
            hora: dados.hora || new Date().toTimeString().split(' ')[0],
            tipo_movimentacao: dados.tipo_movimentacao,
            id_produto: dados.id_produto,
            sku_material: produto.sku,
            nome_material: produto.nome,
            categoria: produto.categoria,
            tag: dados.tag || produto.tag || null,
            quantidade: parseFloat(dados.quantidade),
            quantidade_anterior: quantidade_anterior,
            quantidade_atual: quantidade_atual,
            unidade: produto.unidade_medida,
            valor_unitario: parseFloat(dados.valor_unitario) || parseFloat(produto.valor_unitario) || 0,

            // Colaborador (para saídas)
            id_colaborador: dados.id_colaborador || null,
            nome_colaborador: dados.nome_colaborador || null,
            funcao_colaborador: dados.funcao_colaborador || null,
            contrato_colaborador: dados.contrato_colaborador || null,

            // Origem/Destino
            empresa_origem: dados.empresa_origem || null,
            empresa_destino: dados.empresa_destino || null,

            // Documentos
            numero_nf: dados.numero_nf || null,
            data_nf: dados.data_nf || null,
            chave_nf: dados.chave_nf || null,

            // Vínculos
            id_pedido_compra: dados.id_pedido_compra || null,
            numero_pedido_compra: dados.numero_pedido_compra || null,
            id_solicitacao: dados.id_solicitacao || null,

            // Justificativa
            motivo: dados.motivo || null,
            observacoes: dados.observacoes || null,

            // Localização
            localizacao_origem: dados.localizacao_origem || null,
            localizacao_destino: dados.localizacao_destino || null,

            // Controle
            responsavel: dados.responsavel || usuarioLogado?.nome || 'Sistema',
            app_origem: 'almoxarifado',
            metodo_registro: dados.metodo_registro || 'manual',
            status: 'Confirmada',
            sincronizado: true,
            data_sincronizacao: new Date().toISOString(),
            criado_por: usuarioLogado?.id
        };

        if (modoOffline || !supabase) {
            return await registrarMovimentacaoOffline(movimentacao);
        }

        // Inserir movimentação
        const { data: novaMovimentacao, error } = await supabase
            .from('movimentacoes')
            .insert(movimentacao)
            .select()
            .single();

        if (error) throw error;

        // Atualizar estoque via RPC
        let qtyDelta = 0;
        if (tipo === 'entrada' || tipo === 'devolução' || tipo === 'devolucao') {
            qtyDelta = parseFloat(dados.quantidade);
        } else if (tipo === 'saída' || tipo === 'saida') {
            qtyDelta = -parseFloat(dados.quantidade);
        }

        if (qtyDelta !== 0) {
            await supabase.rpc('atualizar_quantidade_estoque', {
                p_id_produto: dados.id_produto,
                p_delta: qtyDelta
            });
        }

        // Atualizar cache local
        if (!dados_cache.movimentacoes) dados_cache.movimentacoes = [];
        dados_cache.movimentacoes.unshift(novaMovimentacao);
        salvarCache();
        await salvarDadoNoIndexedDB('movimentacoes', novaMovimentacao);

        mostrarNotificacao('✅ Movimentação registrada com sucesso!', 'success');
        return novaMovimentacao;

    } catch (error) {
        console.error('Erro ao criar movimentação:', error);

        // Se offline, salvar na fila
        if (modoOffline || !navigator.onLine || error.message?.includes('fetch')) {
            return await registrarMovimentacaoOffline(dados);
        }

        throw error;
    }
}

/**
 * Gerar código único de movimentação
 */
async function gerarCodigoMovimentacao() {
    try {
        if (modoOffline || !supabase) {
            const ano = new Date().getFullYear();
            const timestamp = Date.now().toString().slice(-4);
            return `MOV-${ano}-${timestamp}`;
        }

        // Buscar último código
        const { data: ultimaMov } = await supabase
            .from('movimentacoes')
            .select('codigo_movimentacao')
            .order('data_registro', { ascending: false })
            .limit(1)
            .maybeSingle();

        const ano = new Date().getFullYear();
        let numero = 1;

        if (ultimaMov?.codigo_movimentacao) {
            const partes = ultimaMov.codigo_movimentacao.split('-');
            if (partes[1] === ano.toString()) {
                numero = parseInt(partes[2]) + 1;
            }
        }

        return `MOV-${ano}-${numero.toString().padStart(4, '0')}`;
    } catch (error) {
        console.error('Erro ao gerar código:', error);
        return `MOV-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;
    }
}

/**
 * Listar movimentações com filtros
 */
async function listarMovimentacoes(filtros = {}) {
    try {
        if (modoOffline || !supabase) {
            let movimentacoes = dados_cache.movimentacoes || [];

            // Aplicar filtros manualmente no cache
            if (filtros.tipo_movimentacao) {
                movimentacoes = movimentacoes.filter(m => m.tipo_movimentacao === filtros.tipo_movimentacao);
            }

            if (filtros.id_colaborador) {
                movimentacoes = movimentacoes.filter(m => m.id_colaborador === filtros.id_colaborador);
            }

            if (filtros.limite) {
                movimentacoes = movimentacoes.slice(0, filtros.limite);
            }

            return movimentacoes;
        }

        let query = supabase
            .from('movimentacoes')
            .select(`
                *,
                produto:produtos_master(nome, categoria),
                colaborador:colaboradores(id_fun, name)
            `)
            .order('data_registro', { ascending: false });

        // Aplicar filtros
        if (filtros.tipo_movimentacao) {
            query = query.eq('tipo_movimentacao', filtros.tipo_movimentacao);
        }

        if (filtros.id_colaborador) {
            query = query.eq('id_colaborador', filtros.id_colaborador);
        }

        if (filtros.categoria) {
            query = query.eq('categoria', filtros.categoria);
        }

        if (filtros.data_inicio && filtros.data_fim) {
            query = query
                .gte('data', filtros.data_inicio)
                .lte('data', filtros.data_fim);
        } else if (filtros.periodo_dias) {
            const dataLimite = new Date();
            dataLimite.setDate(dataLimite.getDate() - filtros.periodo_dias);
            query = query.gte('data', dataLimite.toISOString().split('T')[0]);
        }

        if (filtros.sku) {
            query = query.eq('sku_material', filtros.sku);
        }

        if (filtros.status) {
            query = query.eq('status', filtros.status);
        }

        // Limite de resultados
        const limite = typeof filtros === 'number' ? filtros : (filtros.limite || 500);
        query = query.limit(limite);

        const { data, error } = await query;

        if (error) throw error;

        // Atualizar cache se for uma listagem geral
        if (!filtros.limite && !Object.keys(filtros).length) {
            dados_cache.movimentacoes = data;
            salvarCache();
            await salvarNoIndexedDB('movimentacoes', data);
        }

        return data;

    } catch (error) {
        console.error('Erro ao listar movimentações:', error);
        return dados_cache.movimentacoes || [];
    }
}

/**
 * Buscar movimentações de um produto específico
 */
async function buscarMovimentacoesProduto(id_produto, limite = 50) {
    try {
        if (modoOffline || !supabase) {
            return (dados_cache.movimentacoes || [])
                .filter(m => m.id_produto === id_produto)
                .slice(0, limite);
        }

        const { data, error } = await supabase
            .from('movimentacoes')
            .select('*')
            .eq('id_produto', id_produto)
            .order('data_registro', { ascending: false })
            .limit(limite);

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Erro ao buscar movimentações do produto:', error);
        return (dados_cache.movimentacoes || [])
            .filter(m => m.id_produto === id_produto)
            .slice(0, limite);
    }
}

/**
 * Calcular itens em posse de um colaborador
 */
async function calcularItensEmPosse(id_colaborador) {
    try {
        let movimentacoes = [];

        if (modoOffline || !supabase) {
            movimentacoes = (dados_cache.movimentacoes || [])
                .filter(m => m.id_colaborador === id_colaborador);
        } else {
            const { data } = await supabase
                .from('movimentacoes')
                .select('*')
                .eq('id_colaborador', id_colaborador)
                .order('data_registro', { ascending: true });
            movimentacoes = data || [];
        }

        if (!movimentacoes || movimentacoes.length === 0) {
            return [];
        }

        // Agrupar por produto+tag
        const itensAgrupados = {};

        movimentacoes.forEach(m => {
            const chave = `${m.sku_material}_${m.tag || 'sem_tag'}`;

            if (!itensAgrupados[chave]) {
                itensAgrupados[chave] = {
                    sku: m.sku_material,
                    nome: m.nome_material,
                    categoria: m.categoria,
                    tag: m.tag || '',
                    quantidade: 0,
                    data_primeira_retirada: m.data,
                    movimentacoes: []
                };
            }

            // Somar ou subtrair quantidade
            const tipo = m.tipo_movimentacao.toLowerCase();
            if (tipo === 'saída' || tipo === 'saida') {
                itensAgrupados[chave].quantidade += parseFloat(m.quantidade);
                itensAgrupados[chave].movimentacoes.push({
                    tipo: 'Saída',
                    qtd: parseFloat(m.quantidade),
                    data: m.data
                });
            } else if (tipo === 'entrada' || tipo === 'devolução' || tipo === 'devolucao') {
                itensAgrupados[chave].quantidade -= parseFloat(m.quantidade);
                itensAgrupados[chave].movimentacoes.push({
                    tipo: 'Devolução',
                    qtd: parseFloat(m.quantidade),
                    data: m.data
                });
            }
        });

        // Retornar apenas itens com quantidade positiva (ainda em posse)
        return Object.values(itensAgrupados)
            .filter(item => item.quantidade > 0)
            .sort((a, b) => new Date(a.data_primeira_retirada) - new Date(b.data_primeira_retirada));

    } catch (error) {
        console.error('Erro ao calcular itens em posse:', error);
        return [];
    }
}

/**
 * Registrar saída rápida via código de barras
 */
async function registrarSaidaRapida(dados) {
    try {
        // Validar colaborador
        if (!dados.id_colaborador) {
            throw new Error('Colaborador não informado');
        }

        let colaborador = null;
        if (modoOffline || !supabase) {
            colaborador = (dados_cache.colaboradores || []).find(c => c.id_fun === dados.id_colaborador);
        } else {
            const { data } = await supabase
                .from('colaboradores')
                .select('*')
                .eq('id_fun', dados.id_colaborador)
                .single();
            colaborador = data;
        }

        if (!colaborador) {
            throw new Error('Colaborador não encontrado');
        }

        // Criar movimentação
        return await criarMovimentacao({
            tipo_movimentacao: 'Saída',
            id_produto: dados.id_produto,
            quantidade: dados.quantidade,
            id_colaborador: colaborador.id_fun,
            nome_colaborador: colaborador.name,
            funcao_colaborador: colaborador.role || null,
            contrato_colaborador: colaborador.contract || null,
            observacoes: dados.observacoes || 'Saída rápida via código de barras',
            metodo_registro: 'codigo_barras',
            responsavel: usuarioLogado?.nome || 'Sistema'
        });

    } catch (error) {
        console.error('Erro ao registrar saída rápida:', error);
        throw error;
    }
}

/**
 * Cancelar movimentação
 */
async function cancelarMovimentacao(id, motivo) {
    try {
        if (modoOffline || !supabase) {
            throw new Error('Cancelamento não disponível offline');
        }

        const { data, error } = await supabase
            .from('movimentacoes')
            .update({
                status: 'Cancelada',
                observacoes: `${motivo || 'Cancelada'} | Cancelada em ${new Date().toLocaleString()}`
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        // Atualizar cache
        const index = dados_cache.movimentacoes.findIndex(m => m.id === id);
        if (index !== -1) {
            dados_cache.movimentacoes[index] = data;
            salvarCache();
            await salvarDadoNoIndexedDB('movimentacoes', data);
        }

        mostrarNotificacao('✅ Movimentação cancelada', 'success');
        return data;

    } catch (error) {
        console.error('Erro ao cancelar movimentação:', error);
        throw error;
    }
}

/**
 * Exportar movimentações para CSV
 */
async function exportarMovimentacoesCSV(filtros = {}) {
    try {
        const movimentacoes = await listarMovimentacoes(filtros);

        const csv = [
            'Data,Hora,Código,Tipo,SKU,Produto,Categoria,Quantidade,Unidade,Valor Unit.,Valor Total,Colaborador,Função,Empresa,NF,Observações'
        ];

        movimentacoes.forEach(m => {
            csv.push([
                m.data,
                m.hora,
                m.codigo_movimentacao,
                m.tipo_movimentacao,
                m.sku_material,
                `"${m.nome_material}"`,
                m.categoria,
                m.quantidade,
                m.unidade,
                m.valor_unitario || 0,
                (m.quantidade * (m.valor_unitario || 0)).toFixed(2),
                m.nome_colaborador || '-',
                m.funcao_colaborador || '-',
                m.empresa_origem || m.empresa_destino || '-',
                m.numero_nf || '-',
                `"${m.observacoes || ''}"`
            ].join(','));
        });

        const blob = new Blob([csv.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `movimentacoes_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();

        mostrarNotificacao('✅ Movimentações exportadas!', 'success');

    } catch (error) {
        console.error('Erro ao exportar movimentações:', error);
        mostrarNotificacao('❌ Erro ao exportar movimentações', 'error');
    }
}

async function registrarMovimentacao(movimentacao) {
    return await criarMovimentacao(movimentacao);
}

async function registrarMovimentacaoOffline(mov) {
    const tempId = `temp_mov_${Date.now()}`;
    const novaMov = {
        ...mov,
        id: tempId,
        codigo_movimentacao: mov.codigo_movimentacao || `MOV-OFF-${Date.now()}`,
        data: mov.data || new Date().toISOString().split('T')[0],
        hora: mov.hora || new Date().toTimeString().split(' ')[0],
        status: 'Pendente Sync'
    };

    await adicionarFilaSincronizacao('INSERT', 'movimentacoes', novaMov);
    await salvarDadoNoIndexedDB('movimentacoes', novaMov);

    if (!dados_cache.movimentacoes) dados_cache.movimentacoes = [];
    dados_cache.movimentacoes.unshift(novaMov);
    salvarCache();

    mostrarNotificacao('Movimentação salva offline', 'warning');
    return novaMov;
}

// =====================================================
// COLABORADORES
// =====================================================

async function listarColaboradores() {
    if (modoOffline) return await buscarDaIndexedDB('colaboradores');

    try {
        const { data, error } = await supabase
            .from('colaboradores')
            .select('*')
            .order('name');

        if (error) throw error;
        await salvarNoIndexedDB('colaboradores', data);
        return data;
    } catch (error) {
        console.error('Erro ao listar colaboradores:', error);
        return await buscarDaIndexedDB('colaboradores');
    }
}

async function adicionarColaborador(colaborador) {
    if (modoOffline) {
        const tempId = `temp_col_${Date.now()}`;
        const novoColab = { ...colaborador, id: tempId };
        await adicionarFilaSincronizacao('INSERT', 'colaboradores', novoColab);
        await salvarDadoNoIndexedDB('colaboradores', novoColab);
        return { success: true, data: novoColab };
    }

    try {
        const { data, error } = await supabase.from('colaboradores').insert(colaborador).select().single();
        if (error) throw error;
        await salvarDadoNoIndexedDB('colaboradores', data);
        return { success: true, data };
    } catch (error) {
        console.error('Erro ao adicionar colaborador:', error);
        throw error;
    }
}

// =====================================================
// CATEGORIAS
// =====================================================

async function listarCategorias() {
    if (modoOffline) return await buscarDaIndexedDB('categorias');

    try {
        const { data, error } = await supabase.from('categorias').select('*').order('nome');
        if (error) throw error;
        const nomes = data.map(c => c.nome);
        await salvarNoIndexedDB('categorias', nomes);
        return nomes;
    } catch (error) {
        console.error('Erro ao listar categorias:', error);
        return await buscarDaIndexedDB('categorias');
    }
}

// =====================================================
// AUXILIARES E OFFLINE
// =====================================================

async function gerarProximoSku() {
    try {
        if (modoOffline || !supabase) return gerarProximoSkuLocal();
        const { data, error } = await supabase.rpc('gerar_proximo_sku');
        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Erro ao gerar SKU via RPC:', error);
        return gerarProximoSkuLocal();
    }
}

function gerarProximoSkuLocal() {
    let proximo = parseInt(localStorage.getItem('proximo_sku_local') || '1');
    const sku = String(proximo).padStart(6, '0');
    localStorage.setItem('proximo_sku_local', (proximo + 1).toString());
    return sku;
}

async function criarProdutoOffline(produto, dadosCompletos) {
    produto.id = 'offline_' + Date.now();
    const estoque = {
        id: 'offline_estoque_' + Date.now(),
        id_produto: produto.id,
        sku: produto.sku,
        quantidade: parseFloat(dadosCompletos.quantidade_inicial || 0),
        estoque_minimo: parseFloat(dadosCompletos.estoque_minimo || 0),
        estoque_maximo: parseFloat(dadosCompletos.estoque_maximo || 0),
    };
    const produtoCompleto = { ...produto, estoque: [estoque] };
    await salvarNoIndexedDB('produtos', [produtoCompleto]);
    await salvarNoIndexedDB('estoque', [estoque]);
    await adicionarFilaSincronizacao('INSERT', 'produtos_master', produto);
    await adicionarFilaSincronizacao('INSERT', 'estoque_atual', estoque);
    mostrarNotificacao('Produto salvo offline', 'warning');
    return produtoCompleto;
}

async function atualizarProdutoOffline(id, dadosAtualizados) {
    const produtos = await buscarDaIndexedDB('produtos');
    const index = produtos.findIndex(p => p.id === id);
    if (index === -1) throw new Error('Produto não encontrado');
    produtos[index] = { ...produtos[index], ...dadosAtualizados };
    await salvarNoIndexedDB('produtos', produtos);
    await adicionarFilaSincronizacao('UPDATE', 'produtos_master', produtos[index]);
    mostrarNotificacao('Alteração salva offline', 'warning');
    return produtos[index];
}

async function buscarProdutosCache(filtros = {}) {
    let produtos = await buscarDaIndexedDB('produtos');
    if (filtros.categoria) produtos = produtos.filter(p => p.categoria === filtros.categoria);
    if (filtros.busca) {
        const b = filtros.busca.toLowerCase();
        produtos = produtos.filter(p => p.nome.toLowerCase().includes(b) || p.sku.toLowerCase().includes(b));
    }
    if (filtros.tag) produtos = produtos.filter(p => p.tag?.toUpperCase() === filtros.tag.toUpperCase());
    return produtos;
}

// =====================================================
// LOGS
// =====================================================

async function registrarLog(operacao, tabela, registroId, dadosAntigos, dadosNovos) {
    try {
        const log = {
            usuario_id: usuarioLogado?.id,
            operacao,
            tabela,
            registro_id: registroId,
            dados_antigos: dadosAntigos,
            dados_novos: dadosNovos,
            timestamp: new Date().toISOString(),
            app_origem: 'almoxarifado'
        };
        if (modoOffline || !supabase) {
            await adicionarFilaSincronizacao('INSERT', 'logs_auditoria', log);
            return;
        }
        await supabase.from('logs_auditoria').insert(log);
    } catch (error) {
        console.error('Erro ao registrar log:', error);
    }
}

// =====================================================
// INDEXEDDB - HELPERS
// =====================================================

async function buscarDaIndexedDB(storeName) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
    });
}

async function salvarNoIndexedDB(storeName, dados) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        if (Array.isArray(dados)) {
            store.clear();
            dados.forEach(item => store.put(item));
        } else {
            store.put(dados);
        }
        transaction.oncomplete = () => resolve(true);
        transaction.onerror = () => reject(transaction.error);
    });
}

async function salvarDadoNoIndexedDB(storeName, dado) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.put(dado);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// =====================================================
// SINCRONIZAÇÃO
// =====================================================

async function adicionarFilaSincronizacao(tipo, tabela, dados) {
    const item = {
        id: `sync_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        tipo,
        tabela,
        dados,
        timestamp: new Date().toISOString(),
        status: 'pendente'
    };
    await salvarDadoNoIndexedDB('fila_sync', item);
}

async function sincronizarDados() {
    if (modoOffline || !navigator.onLine) return;
    console.log('🔄 Sincronizando dados...');
    try {
        const fila = await buscarDaIndexedDB('fila_sync');
        const pendentes = fila.filter(item => item.status === 'pendente');
        if (pendentes.length === 0) {
            console.log('✅ Nada para sincronizar');
            return;
        }
        for (const item of pendentes) {
            try {
                if (item.tipo === 'INSERT') {
                    const dados = { ...item.dados };
                    if (typeof dados.id === 'string' && (dados.id.startsWith('temp_') || dados.id.startsWith('offline_'))) {
                        delete dados.id;
                    }
                    await supabase.from(item.tabela).insert(dados);
                } else if (item.tipo === 'UPDATE') {
                    await supabase.from(item.tabela).update(item.dados).eq('id', item.dados.id);
                } else if (item.tipo === 'DELETE') {
                    await supabase.from(item.tabela).delete().eq('id', item.dados.id);
                }
                await salvarDadoNoIndexedDB('fila_sync', { ...item, status: 'sincronizado' });
            } catch (error) {
                console.error('Erro sync:', error);
                await salvarDadoNoIndexedDB('fila_sync', { ...item, status: 'erro', erro: error.message });
            }
        }
        await carregarDadosIniciais();
        mostrarNotificacao('Dados sincronizados!', 'success');
    } catch (error) {
        console.error('Erro na sincronização:', error);
    }
}

// =====================================================
// UI HELPERS
// =====================================================

function mostrarTelaLogin() {
    // Implementar tela de login
    console.log('Mostrando tela de login...');
}

function renderizarApp() {
    // Implementar renderização do app
    console.log('Renderizando aplicativo...');
}

function mostrarNotificacao(mensagem, tipo = 'info') {
    console.log(`[${tipo.toUpperCase()}] ${mensagem}`);

    // Implementar notificação visual
    const notificacao = document.createElement('div');
    notificacao.className = `notification notification-${tipo}`;
    notificacao.textContent = mensagem;

    document.body.appendChild(notificacao);

    setTimeout(() => {
        notificacao.remove();
    }, 3000);
}

// =====================================================
// EXPORTAR FUNÇÕES
// =====================================================

window.TecnomonteApp = {
    // Inicialização
    inicializarApp,

    // Autenticação
    fazerLogin,
    fazerLogout,

    // Produtos
    buscarProdutos,
    buscarProdutoPorId,
    buscarProdutoPorSku,
    buscarProdutoPorTag,
    buscarProdutoPorCodigoBarras,
    criarProduto,
    atualizarProduto,
    inativarProduto,
    deletarProduto,

    // Aliases para compatibilidade
    listarProdutos: buscarProdutos,
    adicionarProduto: criarProduto,

    // Movimentações
    listarMovimentacoes,
    registrarMovimentacao,
    criarMovimentacao,
    buscarMovimentacoesProduto,
    calcularItensEmPosse,
    registrarSaidaRapida,
    cancelarMovimentacao,
    exportarMovimentacoesCSV,
    adicionarMovimentacao: criarMovimentacao,

    // Colaboradores
    listarColaboradores,
    adicionarColaborador,

    // Categorias
    listarCategorias,

    // Sincronização
    sincronizarDados,

    // Utils
    gerarProximoSku,

    // Estado
    get usuarioLogado() { return usuarioLogado; },
    get modoOffline() { return modoOffline; }
};

// =====================================================
// AUTO-INICIALIZAÇÃO
// =====================================================

// Inicializar quando o DOM estiver pronto
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inicializarApp);
} else {
    inicializarApp();
}
