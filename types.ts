
export type Category = string;
export type Unit = 'un' | 'kg' | 'cx' | 'lt' | 'pç';

export const DEFAULT_CATEGORIES: string[] = [
  'Ferramentas',
  'EPI',
  'Material de Escritório',
  'Limpeza',
  'Equipamentos',
  'Outros'
];

export const UNITS: Unit[] = ['un', 'kg', 'cx', 'lt', 'pç'];

export interface User {
  id: string;
  usuario: string;
  senha?: string;
  nome: string;
  nivel: 'admin' | 'operador';
  data_cadastro?: number;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  quantity: number;
  minStock: number;
  category: Category;
  unit: Unit;
  location: string;
  description: string;
  lastUpdated: number;
  isAutoMinStock?: boolean;
  price?: number;
  tag?: string;
  barcode?: string;
  empresa_locadora?: string;
  valor_locacao?: number;
  data_locacao?: string;
  data_validade?: string; // Date string YYYY-MM-DD
  proxima_manutencao?: string; // Date string YYYY-MM-DD
  requer_periodicidade?: boolean;
  dias_periodicidade?: number;
  tipo_periodicidade?: string;
}

export interface Collaborator {
  id_fun: string;
  name: string;
  role: string;
  contract: string;
  isStorekeeper?: boolean; // Defines if this collaborator is a Storekeeper (Almoxarife)
  eh_responsavel_atendimento?: boolean; // NEW: If this collaborator can handle material deliveries
}

export interface CollaboratorPeriodicity {
  id: string;
  id_colaborador: string;
  id_produto: string;
  dias_maximos: number;
  ativo: boolean;
}

export interface Transaction {
  id: string;
  productId: string;
  productName: string;
  type: 'entrada' | 'saida' | 'baixa' | 'devolucao_fornecedor';
  quantity: number;
  timestamp: number;
  userName: string;
  supplier?: string;
  invoiceNumber?: string;
  notes?: string;
  requester?: string;
  department?: string;
  purpose?: string;
  collaboratorId?: string;
  collaboratorRole?: string;
  collaboratorContract?: string;
  originalTransactionCode?: string;
  unitPrice?: number;
  totalValue?: number;
  tag?: string;
  empresa_locadora?: string;
  storekeeperId?: string; // ID of the storekeeper responsible for the transaction
  storekeeperName?: string; // Name of the storekeeper
  responsavel_atendimento_id?: string; // NEW: ID of the collaborator who performed the delivery
  responsavel_atendimento_nome?: string; // NEW: Name of the collaborator who performed the delivery
}

export interface AIAnalysisResult {
  summary: string;
  lowStockAlerts: string[];
  restockSuggestions: string[];
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

export type SortKey = 'name' | 'category' | 'quantity' | 'lastUpdated';
export type SortDirection = 'asc' | 'desc';

export interface SortConfig {
  key: SortKey;
  direction: SortDirection;
}

export interface Supplier {
  id: string;
  nome_fantasia: string;
  razao_social?: string;
  cnpj?: string;
  contato?: string;
  telefone?: string;
  status: 'Ativo' | 'Inativo';
}

export interface AdvancedFilter {
  nameContains: string;
  skuContains: string;
  category: Category | 'Todas';
  locationContains: string;
  minQuantity?: number;
  maxQuantity?: number;
  onlyLowStock: boolean;
}

export type ConnectionStatus = 'online' | 'offline' | 'syncing' | 'error';

export interface SyncItem {
  id: number;
  tipo: 'INSERT' | 'UPDATE' | 'DELETE';
  tabela: string;
  dados: any;
  timestamp: string;
}

