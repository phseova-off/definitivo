
import React, { useState, useEffect, useMemo } from 'react';
import { Search, Filter, Warehouse, History, LayoutList, AlertTriangle, Calendar, LayoutDashboard, Plus, Eye, ArrowUp, ArrowDown, FileBarChart, LogOut, ArrowUpDown, Settings as SettingsIcon, Users, UploadCloud, RefreshCw, Wifi, WifiOff, User as UserIcon, ShieldCheck, X, Check, Download, Package, Clock, FileUp, Tag as TagIcon, Truck } from 'lucide-react';
import ProductForm from './components/ProductForm';
import InventoryStats from './components/InventoryStats';
import Dashboard from './components/Dashboard';
import TransactionModal, { TransactionData } from './components/TransactionModal';
import ProductDetailsModal from './components/ProductDetailsModal';
import Reports from './components/Reports';
import Login from './components/Login';
import ToastContainer from './components/ToastContainer';
import ConfirmModal from './components/ConfirmModal';
import AdvancedSearchModal from './components/AdvancedSearchModal';
import Settings from './components/Settings';
import LabelPrinter from './components/LabelPrinter';
import Collaborators from './components/Collaborators';
import HistoryImportModal, { ImportResult } from './components/HistoryImportModal';
import SupplierReturnModal from './components/SupplierReturnModal';
import { Product, Category, DEFAULT_CATEGORIES, Transaction, ToastMessage, SortConfig, SortKey, AdvancedFilter, Collaborator, ConnectionStatus, User, CollaboratorPeriodicity } from './types';
import { supabaseService } from './services/supabaseService';

type Tab = 'dashboard' | 'inventory' | 'history' | 'reports' | 'collaborators' | 'settings';

const App: React.FC = () => {
  // --- Global State ---
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [isLoading, setIsLoading] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [darkMode, setDarkMode] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('online');
  const [pendingCount, setPendingCount] = useState(0);

  // --- Data State ---
  const [products, setProducts] = useState<Product[]>([]);
  const [history, setHistory] = useState<Transaction[]>([]);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [collaboratorPeriodicities, setCollaboratorPeriodicities] = useState<CollaboratorPeriodicity[]>([]);
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);

  // --- Flow/History Filter State ---
  const [flowFilters, setFlowFilters] = useState({
    colaboradorId: '',
    tipo: '' as '' | 'entrada' | 'saida' | 'baixa' | 'devolucao_fornecedor',
    periodoDias: 30,
    categoria: ''
  });

  // --- Settings State ---
  const [stockCoverageDays, setStockCoverageDays] = useState(45);
  const [quickLaunchCount, setQuickLaunchCount] = useState(6);

  // --- UI State for Modals ---
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [showLabelPrinter, setShowLabelPrinter] = useState(false);
  const [showHistoryImport, setShowHistoryImport] = useState(false);

  // New Modal State for Supplier Return
  const [supplierReturnModal, setSupplierReturnModal] = useState<{
    isOpen: boolean;
    product: Product | null;
  }>({ isOpen: false, product: null });

  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void }>({
    isOpen: false, title: '', message: '', onConfirm: () => { }
  });

  const [transactionModal, setTransactionModal] = useState<{
    isOpen: boolean;
    type: 'entrada' | 'saida';
    product: Product | null;
  }>({ isOpen: false, type: 'entrada', product: null });

  // --- Filter & Sort State for Inventory ---
  const [filterCategory, setFilterCategory] = useState<Category | 'Todas'>('Todas');
  const [searchTerm, setSearchTerm] = useState('');
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);

  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilter>({
    nameContains: '',
    skuContains: '',
    category: 'Todas',
    locationContains: '',
    minQuantity: undefined,
    maxQuantity: undefined,
    onlyLowStock: false
  });
  const [isAdvancedActive, setIsAdvancedActive] = useState(false);

  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'lastUpdated', direction: 'desc' });

  // --- INIT & PERSISTENCE ---

  const loadAllData = async () => {
    setIsLoading(true);
    try {
      const savedUser = localStorage.getItem('almoxarifado_pro_session');
      if (savedUser) setCurrentUser(JSON.parse(savedUser));

      if (darkMode) document.documentElement.classList.add('dark');

      const [loadedProducts, loadedHistory, loadedCollaborators, loadedCategories, loadedPeriodicities] = await Promise.all([
        supabaseService.getInventory(),
        supabaseService.getHistory(),
        supabaseService.list<Collaborator>('colaboradores'),
        supabaseService.list<Category>('categorias'),
        supabaseService.getCollaboratorPeriodicities()
      ]);

      setProducts(loadedProducts);
      setHistory(loadedHistory);
      setCollaborators(loadedCollaborators);
      setCollaboratorPeriodicities(loadedPeriodicities);

      const catNames = (loadedCategories as any[]).map(c => typeof c === 'string' ? c : (c.nome || c.name));
      if (catNames.length > 0) setCategories(catNames);

      setConnectionStatus(supabaseService.getIsOffline() ? 'offline' : 'online');
      setPendingCount(supabaseService.getSyncQueueLength());

    } catch (e) {
      console.error("Error loading data", e);
      addToast('error', 'Erro ao carregar dados. Usando cache local.');
    } finally {
      setIsLoading(false);
    }
  };

  const syncNow = async () => {
    if (supabaseService.getIsOffline()) {
      addToast('info', 'Você está offline. Sincronização ocorrerá ao conectar.');
      return;
    }
    setConnectionStatus('syncing');
    const { success, errors } = await supabaseService.syncPending();
    if (success > 0) addToast('success', `${success} operações sincronizadas!`);
    if (errors > 0) addToast('error', `${errors} falhas na sincronização.`);
    await loadAllData();
  };

  useEffect(() => {
    loadAllData();

    const handleOnline = () => {
      supabaseService.setOffline(false);
      setConnectionStatus('online');
      syncNow();
    };
    const handleOffline = () => {
      supabaseService.setOffline(true);
      setConnectionStatus('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // --- Handlers ---

  const handleLogin = (user: User) => {
    localStorage.setItem('almoxarifado_pro_session', JSON.stringify(user));
    setCurrentUser(user);
    addToast('success', `Bem-vindo à Tecnomonte, ${user.nome}!`);
  };

  const handleLogout = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Sair do Sistema',
      message: 'Deseja encerrar sua sessão?',
      onConfirm: () => {
        localStorage.removeItem('almoxarifado_pro_session');
        setCurrentUser(null);
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const addToast = (type: 'success' | 'error' | 'info', message: string) => {
    const id = crypto.randomUUID();
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };

  const handleSaveProduct = async (productData: Omit<Product, 'id' | 'lastUpdated'>) => {
    setIsLoading(true);
    try {
      if (editingProduct) {
        // Update product metadata in produtos_master
        await supabaseService.update('produtos_master', editingProduct.id, {
          nome: productData.name,
          categoria: productData.category,
          descricao: productData.description,
          unit: productData.unit,
          requer_periodicidade: productData.requer_periodicidade,
          dias_periodicidade: productData.dias_periodicidade,
          tipo_periodicidade: productData.tipo_periodicidade
        });

        // Update stock limits in estoque_atual
        await supabaseService.update('estoque_atual', editingProduct.id, {
          estoque_minimo: productData.minStock
        });

        addToast('success', 'Produto atualizado!');
      } else {
        const productPayload = {
          nome: productData.name,
          categoria: productData.category,
          descricao: productData.description,
          unit: productData.unit,
          requer_periodicidade: productData.requer_periodicidade,
          dias_periodicidade: productData.dias_periodicidade,
          tipo_periodicidade: productData.tipo_periodicidade,
          status: 'Ativo'
        };
        await supabaseService.createProductWithStock(productPayload, productData.quantity);
        addToast('success', 'Produto adicionado!');
      }
      setShowProductForm(false);
      setEditingProduct(null);
      await loadAllData();
    } catch (e) {
      addToast('error', 'Erro ao salvar produto.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTransactionConfirm = (data: TransactionData) => {
    const { product, type } = transactionModal;
    if (product) handleTransactionLogic(product, type, data);
  };

  // Specific Handler for Supplier Return
  const handleSupplierReturnConfirm = (data: { quantity: number; reason: 'fim_uso' | 'dano'; notes: string }) => {
    const { product } = supplierReturnModal;
    if (!product) return;

    const reasonText = data.reason === 'fim_uso' ? 'Fim de Uso / Contrato' : 'Dano / Defeito';
    const transactionData: TransactionData = {
      quantity: data.quantity,
      date: new Date().toISOString().split('T')[0],
      notes: data.notes,
      purpose: `Devolução ao Fornecedor - ${reasonText}`,
      department: product.empresa_locadora ? `Fornecedor: ${product.empresa_locadora}` : 'Fornecedor Externo',
      requester: currentUser?.nome || 'Sistema'
    };

    handleTransactionLogic(product, 'devolucao_fornecedor', transactionData);
    setSupplierReturnModal({ isOpen: false, product: null });
  };

  const handleTransactionLogic = async (product: Product, type: 'entrada' | 'saida' | 'baixa' | 'devolucao_fornecedor', data: TransactionData) => {
    setIsLoading(true);
    try {
      const typeMap: Record<string, 'Entrada' | 'Saída' | 'Devolução'> = {
        'entrada': 'Entrada',
        'saida': 'Saída',
        'devolucao_fornecedor': 'Saída',
        'baixa': 'Saída'
      };

      const transaction = {
        id_produto: product.id,
        tipo_movimentacao: typeMap[type] || 'Saída',
        quantidade: data.quantity,
        usuario_resp: currentUser?.nome || 'Sistema',
        id_colaborador: data.collaboratorId,
        observacoes: data.notes || data.purpose || '',
        tag: data.tag || product.tag,
        unit_price: data.unitPrice,
        total_value: data.totalValue,
        empresa_locadora: data.empresa_locadora || product.empresa_locadora,
        responsavel_atendimento_id: data.responsavel_atendimento_id // NEW: Responsável pelo atendimento
      };

      // 1. Create transaction record and update stock in one call
      await supabaseService.registerMovement(transaction);

      const typeLabel = type === 'entrada' ? 'Entrada/Devolução' : type === 'saida' ? 'Saída' : type === 'devolucao_fornecedor' ? 'Devolução ao Fornecedor' : 'Baixa';
      addToast('success', `${typeLabel} registrada com sucesso!`);
      await loadAllData();
    } catch (e) {
      addToast('error', 'Erro ao registrar movimentação.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickExitConfirm = (product: Product, data: TransactionData) => {
    handleTransactionLogic(product, 'saida', data);
  };

  // --- Collaborator Specific Handlers ---
  const handleCollaboratorReturn = (productId: string, quantity: number, notes?: string, collaboratorId?: string, responsibleId?: string) => {
    const product = products.find(p => p.id === productId);
    const collaborator = collaborators.find(c => c.id_fun === collaboratorId);

    if (product) {
      handleTransactionLogic(product, 'entrada', {
        quantity,
        date: new Date().toISOString().split('T')[0],
        notes: notes || 'Devolução de Material',
        requester: collaborator?.name,
        collaboratorId: collaborator?.id_fun,
        purpose: 'Devolução ao Estoque',
        responsavel_atendimento_id: responsibleId
      });
    }
  };

  const handleCollaboratorWriteOff = (productId: string, quantity: number, notes?: string, collaboratorId?: string) => {
    const product = products.find(p => p.id === productId);
    const collaborator = collaborators.find(c => c.id_fun === collaboratorId);

    if (product) {
      handleTransactionLogic(product, 'baixa', {
        quantity,
        date: new Date().toISOString().split('T')[0],
        notes: notes || 'Descarte/Perda',
        requester: collaborator?.name,
        collaboratorId: collaborator?.id_fun,
        purpose: 'Baixa de Material (Descarte)'
      });
    }
  };

  // --- Flow Filtering Logic ---
  const filteredHistory = useMemo(() => {
    let result = [...history];
    if (flowFilters.colaboradorId) result = result.filter(t => t.collaboratorId === flowFilters.colaboradorId);
    if (flowFilters.tipo === 'devolucao_fornecedor') {
      result = result.filter(t => t.type === 'devolucao_fornecedor' || (t.type === 'saida' && t.purpose?.includes('Devolução ao Fornecedor')));
    } else if (flowFilters.tipo === 'saida') {
      result = result.filter(t => t.type === 'saida' && (!t.purpose || !t.purpose.includes('Devolução ao Fornecedor')));
    } else if (flowFilters.tipo) {
      result = result.filter(t => t.type === flowFilters.tipo);
    }
    if (flowFilters.categoria) {
      result = result.filter(t => {
        const p = products.find(prod => prod.id === t.productId);
        return p?.category === flowFilters.categoria;
      });
    }
    if (flowFilters.periodoDias > 0) {
      const limit = Date.now() - (flowFilters.periodoDias * 24 * 60 * 60 * 1000);
      result = result.filter(t => t.timestamp >= limit);
    }
    return result.sort((a, b) => b.timestamp - a.timestamp);
  }, [history, flowFilters, products]);

  // --- Possession Logic ---
  const possessionItems = useMemo(() => {
    if (!flowFilters.colaboradorId) return [];
    const itemMap = new Map<string, { product: Product; quantity: number; firstWithdrawal: number }>();
    const collabTransactions = history
      .filter(t => t.collaboratorId === flowFilters.colaboradorId)
      .sort((a, b) => a.timestamp - b.timestamp);

    collabTransactions.forEach(t => {
      const prod = products.find(p => p.id === t.productId);
      if (!prod) return;
      const current = itemMap.get(t.productId) || { product: prod, quantity: 0, firstWithdrawal: t.timestamp };

      if (t.type === 'saida') current.quantity += t.quantity;
      else if (t.type === 'entrada' || t.type === 'baixa') current.quantity -= t.quantity;

      if (current.quantity > 0) itemMap.set(t.productId, current);
      else itemMap.delete(t.productId);
    });
    return Array.from(itemMap.values());
  }, [history, flowFilters.colaboradorId, products]);

  const handleExportFilteredHistory = () => {
    const headers = 'Data,Código,Tipo,Produto,SKU,TAG,Locadora,Quantidade,Colaborador\n';
    const csv = headers + filteredHistory.map(t => {
      const date = new Date(t.timestamp).toLocaleDateString('pt-BR');
      const prod = products.find(p => p.id === t.productId);
      const isDev = t.type === 'devolucao_fornecedor' || (t.type === 'saida' && t.purpose?.includes('Devolução ao Fornecedor'));
      const typeStr = t.type === 'entrada' ? 'Entrada' : t.type === 'baixa' ? 'Baixa' : isDev ? 'Devolução ao Fornecedor' : 'Saída';
      return `"${date}","${t.id.slice(0, 8)}","${typeStr}","${t.productName}","${prod?.sku || ''}","${t.tag || ''}","${t.empresa_locadora || ''}","${t.quantity}","${t.requester || ''}"`
    }).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `fluxo_filtrado_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    addToast('success', 'Exportação concluída!');
  };

  const handleHistoryImportComplete = async (result: ImportResult) => {
    setIsLoading(true);
    try {
      for (const p of result.newProducts) await supabaseService.add('produtos_master', p);
      for (const c of result.newCollaborators) await supabaseService.add('colaboradores', c);
      for (const t of result.newTransactions) await supabaseService.add('movimentacoes', t);
      for (const [id, delta] of result.stockAdjustments.entries()) {
        const prod = products.find(p => p.id === id) || result.newProducts.find(p => p.id === id);
        if (prod) {
          const updated = { ...prod, quantity: prod.quantity + delta, lastUpdated: Date.now() };
          await supabaseService.update('produtos_master', updated.id, updated);
        }
      }
      await loadAllData();
      addToast('success', 'Importação concluída!');
    } catch (e) {
      console.error(e);
      addToast('error', 'Erro na importação.');
    } finally {
      setIsLoading(false);
      setShowHistoryImport(false);
    }
  };

  const inventoryFiltered = products.filter(p => {
    const matchesCategory = filterCategory === 'Todas' || p.category === filterCategory;
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || (p.sku && p.sku.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesLowStock = !showLowStockOnly || (p.quantity < p.minStock);
    return matchesCategory && matchesSearch && matchesLowStock;
  });

  const handleSaveCollaboratorPeriodicity = async (data: any) => {
    try {
      // Find existing
      const existing = collaboratorPeriodicities.find(
        cp => cp.id_colaborador === data.id_colaborador && cp.id_produto === data.id_produto
      );

      if (existing) {
        await supabaseService.update('colaboradores_periodicidade', existing.id, {
          dias_maximos: data.dias_maximos,
          ativo: data.ativo
        });
      } else {
        await supabaseService.add('colaboradores_periodicidade', {
          id_colaborador: data.id_colaborador,
          id_produto: data.id_produto,
          dias_maximos: data.dias_maximos,
          ativo: data.ativo
        });
      }

      const updated = await supabaseService.getCollaboratorPeriodicities();
      setCollaboratorPeriodicities(updated);
      addToast('success', 'Periodicidade atualizada com sucesso!');
    } catch (e) {
      console.error(e);
      addToast('error', 'Erro ao salvar periodicidade.');
    }
  };

  // Handler para atualizar colaborador (incluindo eh_responsavel_atendimento)
  const handleUpdateCollaborator = async (collab: Collaborator) => {
    try {
      await supabaseService.update('colaboradores', collab.id_fun, collab);
      await loadAllData();
      addToast('success', 'Colaborador atualizado com sucesso!');
    } catch (e) {
      console.error(e);
      addToast('error', 'Erro ao atualizar colaborador.');
    }
  };

  if (!currentUser) return <Login onLogin={handleLogin} />;

  return (
    <div className={`min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-sans pb-20 transition-colors duration-300`}>
      <ToastContainer toasts={toasts} onRemove={(id) => setToasts(prev => prev.filter(t => t.id !== id))} />
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
      />
      {showAdvancedSearch && <AdvancedSearchModal isOpen={showAdvancedSearch} onClose={() => setShowAdvancedSearch(false)} currentFilters={advancedFilters} categories={categories} onSearch={(filters) => { setAdvancedFilters(filters); setIsAdvancedActive(true); setSearchTerm(''); }} />}
      {showLabelPrinter && <LabelPrinter products={products} onClose={() => setShowLabelPrinter(false)} />}
      {showHistoryImport && <HistoryImportModal isOpen={showHistoryImport} onClose={() => setShowHistoryImport(false)} products={products} collaborators={collaborators} existingHistory={history} onImportComplete={handleHistoryImportComplete} />}

      {/* Supplier Return Modal */}
      {supplierReturnModal.isOpen && supplierReturnModal.product && (
        <SupplierReturnModal
          isOpen={supplierReturnModal.isOpen}
          onClose={() => setSupplierReturnModal({ isOpen: false, product: null })}
          product={supplierReturnModal.product}
          onConfirm={handleSupplierReturnConfirm}
        />
      )}

      <header className="bg-tecnomonte-blue border-b border-tecnomonte-gold/30 sticky top-0 z-30 print:hidden shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-tecnomonte-gold p-2.5 rounded-sm text-tecnomonte-blue shadow-md border-r-4 border-white/20">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h1 className="text-xl md:text-2xl font-black text-white tracking-tighter hidden sm:block">
                TECNOMONTE <span className="text-tecnomonte-gold font-light ml-1 text-sm tracking-widest uppercase opacity-80">Almoxarifado</span>
              </h1>
            </div>
            <div className="hidden md:flex space-x-1 bg-white/5 p-1 rounded-sm border border-white/10">
              {(['dashboard', 'inventory', 'history', 'reports', 'collaborators', 'settings'] as Tab[]).map((tab) => (
                <button key={tab} onClick={() => setActiveTab(tab)} className={`flex items-center gap-2 px-3 py-2 rounded-sm text-xs font-bold uppercase tracking-wider transition-all ${activeTab === tab ? 'bg-tecnomonte-gold text-tecnomonte-blue shadow-sm' : 'text-white/70 hover:text-white hover:bg-white/10'}`}>
                  {tab === 'dashboard' && <LayoutDashboard className="w-4 h-4" />}
                  {tab === 'inventory' && <LayoutList className="w-4 h-4" />}
                  {tab === 'history' && <History className="w-4 h-4" />}
                  {tab === 'reports' && <FileBarChart className="w-4 h-4" />}
                  {tab === 'collaborators' && <Users className="w-4 h-4" />}
                  {tab === 'settings' && <SettingsIcon className="w-4 h-4" />}
                  {tab === 'dashboard' ? 'Dash' : tab === 'inventory' ? 'Materiais' : tab === 'history' ? 'Fluxo' : tab === 'reports' ? 'Relatórios' : tab === 'collaborators' ? 'Equipe' : 'Config'}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <div
                onClick={syncNow}
                className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-sm text-[10px] font-black uppercase border tracking-widest cursor-pointer transition-all ${connectionStatus === 'online' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                  connectionStatus === 'syncing' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                    `bg-amber-500/10 text-amber-400 border-amber-500/20`
                  }`}
              >
                {connectionStatus === 'online' ? '● Online' :
                  connectionStatus === 'syncing' ? <RefreshCw className="w-3 h-3 animate-spin" /> :
                    `⚠ Offline (${pendingCount})`}
              </div>
              <button onClick={handleLogout} className="p-2 text-white/50 hover:text-red-400 hover:bg-red-400/10 rounded-sm transition-colors"><LogOut className="w-5 h-5" /></button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {isLoading && (
          <div className="fixed inset-0 bg-white/50 dark:bg-black/50 z-50 flex items-center justify-center backdrop-blur-[1px]">
            <div className="bg-white dark:bg-slate-800 px-6 py-3 rounded-sm shadow-2xl border border-tecnomonte-blue/10 flex items-center gap-3">
              <div className="w-5 h-5 border-2 border-tecnomonte-blue border-t-transparent rounded-full animate-spin"></div>
              <span className="text-tecnomonte-blue dark:text-white font-bold text-xs uppercase tracking-widest">Aguarde...</span>
            </div>
          </div>
        )}

        {activeTab === 'dashboard' && (
          <Dashboard
            products={products}
            history={history}
            collaborators={collaborators}
            collaboratorPeriodicities={collaboratorPeriodicities}
            categories={categories}
            onNavigateToInventory={() => setActiveTab('inventory')}
            quickLaunchCount={quickLaunchCount}
            onQuickExit={handleQuickExitConfirm}
          />
        )}

        {activeTab === 'inventory' && (
          <div className="space-y-6">
            {showProductForm ? <ProductForm initialData={editingProduct} categories={categories} allProducts={products} onSave={handleSaveProduct} onCancel={() => { setShowProductForm(false); setEditingProduct(null); }} /> : (
              <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white dark:bg-slate-800 p-4 rounded-sm border border-slate-200 shadow-sm">
                <div>
                  <h2 className="text-lg font-black text-tecnomonte-blue dark:text-white uppercase">Gestão de Materiais</h2>
                  <p className="text-xs text-slate-500">Controle efetivo de estoque industrial</p>
                </div>
                <button onClick={() => setShowProductForm(true)} className="bg-tecnomonte-blue text-white px-6 py-2.5 rounded-sm text-xs font-bold uppercase tracking-widest flex items-center gap-2 shadow-md">
                  <Plus className="w-5 h-5" /> Adicionar Material
                </button>
              </div>
            )}

            <div className="bg-white dark:bg-slate-800 p-4 rounded-sm border border-slate-200">
              <div className="flex gap-4 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input type="text" placeholder="Buscar material..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-9 pr-4 py-2 border rounded-sm outline-none dark:bg-slate-700" />
                </div>
                <button onClick={() => setShowLowStockOnly(!showLowStockOnly)} className={`px-4 py-2 rounded-sm text-xs font-bold border ${showLowStockOnly ? 'bg-red-500 text-white' : 'bg-slate-100'}`}>Estoque Crítico</button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50 text-xs font-black uppercase text-slate-500 border-b">
                      <th className="p-4">SKU / Material</th>
                      <th className="p-4">Categoria</th>
                      <th className="p-4">Estoque</th>
                      <th className="p-4">TAG</th>
                      <th className="p-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inventoryFiltered.map(p => (
                      <tr key={p.id} className="border-b hover:bg-slate-50 dark:hover:bg-slate-700">
                        <td className="p-4">
                          <p className="font-bold text-slate-900 dark:text-white">{p.name}</p>
                          <p className="text-[10px] text-slate-400 font-mono">{p.sku || '-'}</p>
                          {p.empresa_locadora && <p className="text-[9px] text-amber-600 font-bold uppercase">{p.empresa_locadora}</p>}
                        </td>
                        <td className="p-4 text-xs font-medium text-slate-600">{p.category}</td>
                        <td className="p-4">
                          <span className={`font-mono font-bold ${p.quantity < p.minStock ? 'text-red-500' : ''}`}>{p.quantity} {p.unit}</span>
                        </td>
                        <td className="p-4">
                          {p.tag ? <code className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold border border-blue-100">{p.tag}</code> : <span className="text-slate-300">-</span>}
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex justify-end gap-2">
                            {/* Botão de Devolução ao Fornecedor - Apenas para Equipamentos */}
                            {p.category === 'Equipamentos' && (
                              <button
                                onClick={() => setSupplierReturnModal({ isOpen: true, product: p })}
                                className="p-2 text-sky-600 hover:bg-sky-50 rounded"
                                title="Devolver ao Fornecedor"
                              >
                                <Truck className="w-4 h-4" />
                              </button>
                            )}

                            <button onClick={() => setTransactionModal({ isOpen: true, type: 'entrada', product: p })} className="p-2 text-emerald-600"><ArrowUp className="w-4 h-4" /></button>
                            <button onClick={() => setTransactionModal({ isOpen: true, type: 'saida', product: p })} className="p-2 text-red-600"><ArrowDown className="w-4 h-4" /></button>
                            <button onClick={() => setSelectedProduct(p)} className="p-2 text-tecnomonte-blue"><Eye className="w-4 h-4" /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Filtros de Fluxo Avançados */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-sm border border-slate-200 shadow-sm">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <h3 className="text-lg font-black text-tecnomonte-blue dark:text-white uppercase flex items-center gap-2">
                  <Filter className="w-5 h-5 text-tecnomonte-gold" /> Filtros de Auditoria (Fluxo)
                </h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowHistoryImport(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-tecnomonte-gold hover:text-tecnomonte-blue dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-black uppercase tracking-widest rounded-sm border border-slate-200 dark:border-slate-600 transition-all shadow-sm"
                  >
                    <FileUp className="w-4 h-4" /> Importar
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Colaborador</label>
                  <select
                    value={flowFilters.colaboradorId}
                    onChange={(e) => setFlowFilters(prev => ({ ...prev, colaboradorId: e.target.value }))}
                    className="w-full p-2 bg-slate-50 border rounded-sm text-sm outline-none dark:bg-slate-700"
                  >
                    <option value="">Todos os colaboradores</option>
                    {collaborators.map(c => (<option key={c.id_fun} value={c.id_fun}>{c.name} ({c.id_fun})</option>))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Tipo Movimentação</label>
                  <select value={flowFilters.tipo} onChange={(e) => setFlowFilters(prev => ({ ...prev, tipo: e.target.value as any }))} className="w-full p-2 bg-slate-50 border rounded-sm text-sm outline-none dark:bg-slate-700">
                    <option value="">Todas</option>
                    <option value="entrada">Entradas</option>
                    <option value="saida">Saídas</option>
                    <option value="devolucao_fornecedor">Devolução ao Fornecedor</option>
                    <option value="baixa">Baixas</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Período</label>
                  <select value={flowFilters.periodoDias} onChange={(e) => setFlowFilters(prev => ({ ...prev, periodoDias: Number(e.target.value) }))} className="w-full p-2 bg-slate-50 border rounded-sm text-sm outline-none dark:bg-slate-700">
                    <option value="7">Últimos 7 dias</option><option value="30">Últimos 30 dias</option><option value="90">Últimos 90 dias</option><option value="0">Todo o período</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Setor / Categoria</label>
                  <select value={flowFilters.categoria} onChange={(e) => setFlowFilters(prev => ({ ...prev, categoria: e.target.value }))} className="w-full p-2 bg-slate-50 border rounded-sm text-sm outline-none dark:bg-slate-700">
                    <option value="">Todas as categorias</option>
                    {categories.map(cat => (<option key={cat} value={cat}>{cat}</option>))}
                  </select>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t flex flex-wrap gap-2">
                <button onClick={() => setFlowFilters({ colaboradorId: '', tipo: '', periodoDias: 30, categoria: '' })} className="px-4 py-2 bg-slate-100 text-slate-600 text-xs font-bold uppercase rounded-sm hover:bg-slate-200 transition-all">🔄 Limpar Filtros</button>
                <button onClick={handleExportFilteredHistory} className="px-4 py-2 bg-tecnomonte-blue text-white text-xs font-bold uppercase rounded-sm hover:bg-tecnomonte-dark transition-all flex items-center gap-2"><Download className="w-4 h-4" /> Exportar Filtrado</button>
              </div>
            </div>

            {/* SEÇÃO ITENS EM POSSE */}
            {flowFilters.colaboradorId && (
              <div className="bg-white dark:bg-slate-800 p-6 rounded-sm border-l-4 border-emerald-500 shadow-md animate-in slide-in-from-top-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-black text-emerald-700 dark:text-emerald-400 uppercase flex items-center gap-2">
                    <Package className="w-5 h-5" /> Itens em posse de {collaborators.find(c => c.id_fun === flowFilters.colaboradorId)?.name}
                  </h3>
                </div>
                {possessionItems.length === 0 ? (
                  <div className="p-4 bg-emerald-50 text-emerald-700 text-sm rounded-sm">✓ Este colaborador não possui itens pendentes de devolução.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead><tr className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 border-b"><th className="p-4">Material / SKU</th><th className="p-4">Qtd Atual</th><th className="p-4">TAG</th><th className="p-4">Data Retirada</th><th className="p-4">Tempo de Posse</th></tr></thead>
                      <tbody className="divide-y">
                        {possessionItems.map(item => {
                          const days = Math.floor((Date.now() - item.firstWithdrawal) / (1000 * 60 * 60 * 24));
                          const color = days > 30 ? 'text-red-600 font-black' : days > 15 ? 'text-amber-600 font-bold' : 'text-emerald-600';
                          return (
                            <tr key={item.product.id} className="hover:bg-slate-50 dark:hover:bg-slate-700">
                              <td className="p-4"><p className="font-bold">{item.product.name}</p><p className="text-[10px] text-slate-400 font-mono">{item.product.sku}</p></td>
                              <td className="p-4"><span className="bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded text-xs font-mono font-bold">{item.quantity} {item.product.unit}</span></td>
                              <td className="p-4">{item.product.tag ? <code className="text-[10px] font-bold bg-blue-50 text-blue-700 px-1 rounded">{item.product.tag}</code> : '-'}</td>
                              <td className="p-4 text-xs text-slate-500">{new Date(item.firstWithdrawal).toLocaleDateString()}</td>
                              <td className={`p-4 text-xs ${color}`}><div className="flex items-center gap-1"><Clock className="w-3 h-3" /> {days} dias</div></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* TABELA DE FLUXO PRINCIPAL */}
            <div className="bg-white dark:bg-slate-800 rounded-sm shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-4 bg-slate-50 dark:bg-slate-900 border-b flex justify-between items-center">
                <h4 className="text-sm font-black text-slate-600 uppercase">Tabela de Fluxo de Materiais</h4>
                <span className="text-[10px] text-slate-400 font-bold">{filteredHistory.length} movimentações encontradas</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-widest border-b">
                      <th className="px-6 py-4">Data/Hora</th><th className="px-6 py-4">Material / TAG</th><th className="px-6 py-4">Status</th><th className="px-6 py-4">Solicitante</th><th className="px-6 py-4">Responsável</th><th className="px-6 py-4 text-right">Saldo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {filteredHistory.length === 0 ? (<tr><td colSpan={6} className="px-6 py-12 text-center text-slate-400 uppercase text-xs">Nenhum registro encontrado</td></tr>) : (
                      filteredHistory.map((tx) => (
                        <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                          <td className="px-6 py-4 text-xs font-bold text-slate-500">{new Date(tx.timestamp).toLocaleDateString()} <span className="text-[9px] opacity-60 ml-1">{new Date(tx.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></td>
                          <td className="px-6 py-4">
                            <p className="font-bold text-slate-800 dark:text-slate-200">{tx.productName}</p>
                            {tx.tag && <p className="text-[9px] font-bold text-blue-600 uppercase">TAG: {tx.tag}</p>}
                          </td>
                          <td className="px-6 py-4">
                            {(() => {
                              const isDevolucao = tx.type === 'devolucao_fornecedor' || (tx.type === 'saida' && tx.purpose?.includes('Devolução ao Fornecedor'));
                              let colorClass = 'bg-slate-200 text-slate-600';
                              let label = '🗑️ Baixa';

                              if (tx.type === 'entrada') {
                                colorClass = 'bg-emerald-100 text-emerald-700';
                                label = (tx.purpose === 'Devolução ao Estoque' || tx.collaboratorId) ? '↩️ Devolução' : '⬇️ Entrada';
                              } else if (isDevolucao) {
                                colorClass = 'bg-amber-100 text-amber-700';
                                label = '🚚 Devolução Fornecedor';
                              } else if (tx.type === 'saida') {
                                colorClass = 'bg-red-100 text-red-700';
                                label = '⬆️ Saída';
                              }

                              return (
                                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-sm text-[10px] font-black uppercase ${colorClass}`}>
                                  {label}
                                </span>
                              );
                            })()}
                          </td>
                          <td className="px-6 py-4 text-xs font-bold text-slate-600 dark:text-slate-400 uppercase">{(() => {
                            const collaboratorName = tx.requester || collaborators.find(c => c.id_fun === tx.collaboratorId)?.name || '-';
                            return <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase">{collaboratorName}</span>;
                          })()}</td>
                          <td className="px-6 py-4">
                            {tx.responsavel_atendimento_nome ? (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-sm text-[10px] font-bold bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                                <UserIcon className="w-3 h-3" />
                                {tx.responsavel_atendimento_nome}
                              </span>
                            ) : (
                              <span className="text-xs text-slate-400">-</span>
                            )}
                          </td>
                          <td className={`px-6 py-4 text-right font-mono font-black ${tx.type === 'entrada' ? 'text-emerald-600' : tx.type === 'saida' ? 'text-red-600' : 'text-slate-500'}`}>
                            {tx.type === 'entrada' ? '+' : '-'}{tx.quantity}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'reports' && <Reports products={products} history={history} collaborators={collaborators} />}
        {activeTab === 'collaborators' && (
          <Collaborators
            collaborators={collaborators}
            history={history}
            products={products}
            collaboratorPeriodicities={collaboratorPeriodicities}
            onAdd={(c) => supabaseService.add('colaboradores', c).then(loadAllData)}
            onDelete={(id) => supabaseService.delete('colaboradores', id, 'id_fun').then(loadAllData)}
            onImport={(list) => Promise.all(list.map(c => supabaseService.add('colaboradores', c))).then(loadAllData)}
            onReturnItem={handleCollaboratorReturn}
            onWriteOffItem={handleCollaboratorWriteOff}
            onSavePeriodicity={handleSaveCollaboratorPeriodicity}
            onUpdateCollaborator={handleUpdateCollaborator}
            currentUser={currentUser}
          />
        )}
        {activeTab === 'settings' && <Settings darkMode={darkMode} toggleDarkMode={() => setDarkMode(!darkMode)} productCount={products.length} products={products} categories={categories} onAddCategory={(c) => setCategories(prev => [...prev, c])} onEditCategory={(o, n) => setCategories(prev => prev.map(c => c === o ? n : c))} onDeleteCategory={(c) => setCategories(prev => prev.filter(cat => cat !== c))} stockCoverageDays={stockCoverageDays} onUpdateStockCoverageDays={setStockCoverageDays} quickLaunchCount={quickLaunchCount} onUpdateQuickLaunchCount={setQuickLaunchCount} onExportBackup={() => { }} onImportCSV={() => { }} onImportBackup={() => { }} onOpenLabelPrinter={() => setShowLabelPrinter(true)} />}
      </main>

      {/* Navegação Mobile */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-tecnomonte-blue border-t border-tecnomonte-gold/50 z-40 px-2 py-2 flex justify-between">
        {(['dashboard', 'inventory', 'history', 'reports', 'collaborators', 'settings'] as Tab[]).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`flex flex-col items-center gap-1 p-2 rounded-sm text-[8px] font-black uppercase tracking-widest ${activeTab === tab ? 'text-tecnomonte-gold' : 'text-white/40'}`}>
            {tab === 'dashboard' && <LayoutDashboard className="w-5 h-5" />}
            {tab === 'inventory' && <LayoutList className="w-5 h-5" />}
            {tab === 'history' && <History className="w-5 h-5" />}
            {tab === 'reports' && <FileBarChart className="w-5 h-5" />}
            {tab === 'collaborators' && <Users className="w-5 h-5" />}
            {tab === 'settings' && <SettingsIcon className="w-5 h-5" />}
            {tab === 'history' ? 'Fluxo' : tab.slice(0, 4)}
          </button>
        ))}
      </div>

      {transactionModal.product && <TransactionModal isOpen={transactionModal.isOpen} onClose={() => setTransactionModal(prev => ({ ...prev, isOpen: false }))} type={transactionModal.type} product={transactionModal.product} collaborators={collaborators} onConfirm={handleTransactionConfirm} />}
      {selectedProduct && <ProductDetailsModal product={selectedProduct} history={history} onClose={() => setSelectedProduct(null)} onEdit={() => { setSelectedProduct(null); setEditingProduct(selectedProduct); setShowProductForm(true); }} onDelete={() => { }} />}
    </div>
  );
};

export default App;
