/**
 * Declarações de tipos para a integração JavaScript Supabase
 */

interface TecnomonteProducto {
    id: string;
    sku?: string;
    nome: string;
    categoria: string;
    unidade_medida: string;
    localizacao?: string;
    descricao?: string;
    quantidade?: number;
    estoque_minimo?: number;
    preco_venda?: number;
    barcode?: string;
    tag?: string;
    empresa_locadora?: string;
    valor_locacao?: number;
    status?: string;
    data_atualizacao?: string;
    estoque?: any[];
    fornecedor?: any;
}

interface TecnomonteMovimentacao {
    id: string;
    tipo_movimentacao: 'entrada' | 'saida' | 'saída' | 'devolucao_fornecedor';
    id_produto: string;
    nome_material: string;
    quantidade: number;
    data: string;
    id_colaborador?: string;
    nome_colaborador?: string;
    observacoes?: string;
    categoria?: string;
}

/**
 * Interface principal da integração Tecnomonte
 */
interface TecnomonteApp {
    // Inicialização
    inicializarApp(): Promise<void>;

    // Autenticação
    fazerLogin(usuario: string, senha: string): Promise<any>;
    fazerLogout(): Promise<void>;

    // Produtos
    buscarProdutos(filtros?: any): Promise<TecnomonteProducto[]>;
    buscarProdutoPorId(id: string): Promise<TecnomonteProducto>;
    buscarProdutoPorSku(sku: string): Promise<TecnomonteProducto | null>;
    buscarProdutoPorTag(tag: string): Promise<TecnomonteProducto | null>;
    buscarProdutoPorCodigoBarras(codigo: string): Promise<TecnomonteProducto | null>;
    criarProduto(dados: any): Promise<TecnomonteProducto>;
    atualizarProduto(id: string, dados: any): Promise<TecnomonteProducto>;
    inativarProduto(id: string): Promise<TecnomonteProducto>;
    deletarProduto(id: string): Promise<boolean>;

    // Aliases
    listarProdutos(filtros?: any): Promise<TecnomonteProducto[]>;
    adicionarProduto(dados: any): Promise<TecnomonteProducto>;

    // Movimentações
    listarMovimentacoes(filtros?: any): Promise<TecnomonteMovimentacao[]>;
    registrarMovimentacao(mov: any): Promise<any>;
    criarMovimentacao(dados: any): Promise<TecnomonteMovimentacao>;
    buscarMovimentacoesProduto(id_produto: string, limite?: number): Promise<TecnomonteMovimentacao[]>;
    calcularItensEmPosse(id_colaborador: string): Promise<any[]>;
    registrarSaidaRapida(dados: any): Promise<TecnomonteMovimentacao>;
    cancelarMovimentacao(id: string, motivo?: string): Promise<any>;
    exportarMovimentacoesCSV(filtros?: any): Promise<void>;
    adicionarMovimentacao(mov: any): Promise<any>;

    // Colaboradores
    listarColaboradores(): Promise<any[]>;
    adicionarColaborador(dados: any): Promise<any>;

    // Categorias
    listarCategorias(): Promise<string[]>;

    // Sincronização
    sincronizarDados(): Promise<void>;

    // Utils
    gerarProximoSku(): Promise<string>;

    // Estado
    readonly usuarioLogado: any;
    readonly modoOffline: boolean;
}

declare global {
    interface Window {
        TecnomonteApp: TecnomonteApp;
    }
}

export { };
