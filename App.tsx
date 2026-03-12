import React, { useState, useEffect, useRef } from 'react';
import { 
  Candy, 
  ShoppingCart, 
  History, 
  Package, 
  Plus, 
  Trash2, 
  Download, 
  Search,
  Store,
  Check,
  X,
  Zap,
  TrendingUp,
  Box,
  LayoutDashboard,
  Camera,
  CreditCard,
  Banknote,
  Smartphone,
  User,
  FileText,
  AlertTriangle,
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Product {
  id: number;
  name: string;
  price: number;
  stock: number;
  category: string;
  image?: string;
  code?: string;
}

interface SaleItem {
  product_id: number;
  name: string;
  quantity: number;
  price: number;
}

interface Sale {
  id: number;
  subtotal: number;
  tax: number;
  total: number;
  date: string;
  customer_name: string;
  customer_id: string;
  customer_type: string;
  payment_method: string;
  items: string;
}

export default function App() {
  const [view, setView] = useState<'dashboard' | 'pos' | 'inventory' | 'history'>('dashboard');
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<SaleItem[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [customerType, setCustomerType] = useState<'Consumidor Final' | 'Con Datos'>('Consumidor Final');
  const [paymentMethod, setPaymentMethod] = useState<'Efectivo' | 'Transferencia' | 'Deuna'>('Efectivo');
  const [searchTerm, setSearchTerm] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showInvoice, setShowInvoice] = useState<number | null>(null);
  
  // Inventory form state
  const [newProduct, setNewProduct] = useState({ 
    name: '', 
    price: '', 
    stock: '', 
    category: 'Dulces',
    image: '',
    code: '' 
  });
  const [scanCode, setScanCode] = useState('');
  const scanInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchProducts();
    fetchSales();
  }, []);

  const fetchProducts = async () => {
    const res = await fetch('/api/products');
    const data = await res.json();
    setProducts(data);
  };

  const fetchSales = async () => {
    const res = await fetch('/api/sales');
    const data = await res.json();
    setSales(data);
  };

  // Dashboard Stats
  const totalRevenue = sales.reduce((sum, s) => sum + s.total, 0);
  const salesToday = sales.filter(s => {
    // SQLite date is YYYY-MM-DD HH:MM:SS (UTC)
    // Convert to ISO format for better parsing
    const dateStr = s.date.replace(' ', 'T') + 'Z';
    const saleDate = new Date(dateStr);
    return saleDate.toDateString() === new Date().toDateString();
  });
  const revenueToday = salesToday.reduce((sum, s) => sum + s.total, 0);
  const lowStockProducts = products.filter(p => p.stock < 10);

  const addToCart = (product: Product) => {
    if (product.stock <= 0) return;
    setCart(prev => {
      const existing = prev.find(item => item.product_id === product.id);
      if (existing) {
        return prev.map(item => 
          item.product_id === product.id 
            ? { ...item, quantity: Math.min(item.quantity + 1, product.stock) } 
            : item
        );
      }
      return [...prev, { product_id: product.id, name: product.name, quantity: 1, price: product.price }];
    });
  };

  const removeFromCart = (productId: number) => {
    setCart(prev => prev.filter(item => item.product_id !== productId));
  };

  const updateCartQuantity = (productId: number, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.product_id === productId) {
        const product = products.find(p => p.id === productId);
        const newQty = Math.max(1, Math.min(item.quantity + delta, product?.stock || 999));
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const taxRate = customerType === 'Con Datos' ? 0.15 : 0;
  const tax = subtotal * taxRate;
  const total = subtotal + tax;

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setIsProcessing(true);
    try {
      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subtotal,
          tax,
          total,
          customer_name: customerType === 'Consumidor Final' ? 'Consumidor Final' : customerName,
          customer_id: customerType === 'Consumidor Final' ? '9999999999999' : customerId,
          customer_type: customerType,
          payment_method: paymentMethod,
          items: cart
        })
      });
      const data = await res.json();
      if (data.id) {
        setShowInvoice(data.id);
        setCart([]);
        setCustomerName('');
        setCustomerId('');
        setCustomerType('Consumidor Final');
        setPaymentMethod('Efectivo');
        await fetchProducts();
        await fetchSales();
        
        setTimeout(() => {
          window.print();
        }, 500);
      } else {
        alert("Error al procesar la venta: " + (data.error || "Desconocido"));
      }
    } catch (error) {
      console.error(error);
      alert("Error de conexión al procesar la venta.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewProduct(prev => ({ ...prev, image: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...newProduct,
        price: parseFloat(newProduct.price),
        stock: parseInt(newProduct.stock)
      })
    });
    const data = await res.json();
    if (res.ok) {
      setNewProduct({ name: '', price: '', stock: '', category: 'Dulces', image: '', code: '' });
      if (fileInputRef.current) fileInputRef.current.value = '';
      fetchProducts();
    } else {
      alert("Error: " + data.error);
    }
  };

  const handleScan = (e: React.FormEvent) => {
    e.preventDefault();
    const product = products.find(p => p.code === scanCode);
    if (product) {
      addToCart(product);
      setScanCode('');
    } else {
      alert("Producto no encontrado con el código: " + scanCode);
      setScanCode('');
    }
  };

  const handleDeleteProduct = async (id: number) => {
    if (confirm('¿Estás seguro de eliminar este producto?')) {
      await fetch(`/api/products/${id}`, { method: 'DELETE' });
      fetchProducts();
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-white font-sans selection:bg-blue-500/30">
      {/* Sidebar Navigation */}
      <div className="fixed left-0 top-0 h-full w-20 md:w-64 bg-[#111114] border-r border-white/5 z-30 flex flex-col">
        <div className="p-6 flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/20">
            <Zap className="text-white fill-white" size={24} />
          </div>
          <h1 className="hidden md:block text-xl font-bold tracking-tight">Candy<span className="text-blue-500">Tech</span></h1>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          {[
            { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
            { id: 'pos', icon: ShoppingCart, label: 'Ventas' },
            { id: 'inventory', icon: Package, label: 'Inventario' },
            { id: 'history', icon: History, label: 'Historial' }
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setView(item.id as any)}
              className={`w-full flex items-center gap-4 p-3 rounded-xl transition-all duration-200 group ${
                view === item.id 
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' 
                  : 'text-gray-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <item.icon size={20} className={view === item.id ? 'text-white' : 'text-gray-400 group-hover:text-white'} />
              <span className="hidden md:block font-medium text-sm">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-6 border-t border-white/5">
          <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-[10px] uppercase font-bold tracking-widest text-gray-400">System Active</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="ml-20 md:ml-64 p-8">
        <AnimatePresence mode="wait">
          {view === 'dashboard' && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h2 className="text-3xl font-bold tracking-tight">Bienvenido de nuevo</h2>
                  <p className="text-gray-400 mt-1">Aquí tienes el resumen de tu negocio hoy.</p>
                </div>
                <div className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-sm font-medium text-gray-300">
                  {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                </div>
              </header>

              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { label: 'Ventas Hoy', value: `$${revenueToday.toFixed(2)}`, icon: TrendingUp, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
                  { label: 'Ingresos Totales', value: `$${totalRevenue.toFixed(2)}`, icon: Store, color: 'text-blue-400', bg: 'bg-blue-400/10' },
                  { label: 'Transacciones', value: sales.length, icon: Check, color: 'text-purple-400', bg: 'bg-purple-400/10' },
                  { label: 'Alertas Stock', value: lowStockProducts.length, icon: AlertTriangle, color: lowStockProducts.length > 0 ? 'text-red-400' : 'text-gray-400', bg: lowStockProducts.length > 0 ? 'bg-red-400/10' : 'bg-gray-400/10' }
                ].map((stat, i) => (
                  <div key={i} className="bg-white/5 border border-white/10 p-6 rounded-2xl hover:border-white/20 transition-colors">
                    <div className={`w-12 h-12 ${stat.bg} rounded-xl flex items-center justify-center mb-4`}>
                      <stat.icon className={stat.color} size={24} />
                    </div>
                    <p className="text-sm text-gray-400 font-medium">{stat.label}</p>
                    <h3 className="text-2xl font-bold mt-1">{stat.value}</h3>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Recent Sales */}
                <div className="lg:col-span-2 bg-white/5 border border-white/10 rounded-2xl p-6">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                      <History size={20} className="text-blue-500" /> Ventas Recientes
                    </h3>
                    <button onClick={() => setView('history')} className="text-sm text-blue-500 hover:underline">Ver todo</button>
                  </div>
                  <div className="space-y-3">
                    {sales.slice(0, 5).map(sale => (
                      <div key={sale.id} className="flex justify-between items-center p-4 bg-white/[0.02] border border-white/5 rounded-xl hover:bg-white/[0.05] transition-colors">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
                            <User size={18} className="text-blue-400" />
                          </div>
                          <div>
                            <p className="font-semibold text-sm">{sale.customer_name}</p>
                            <p className="text-xs text-gray-500">{new Date(sale.date).toLocaleTimeString()}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-sm">${sale.total.toFixed(2)}</p>
                          <p className="text-[10px] text-gray-500 uppercase font-bold">{sale.payment_method}</p>
                        </div>
                      </div>
                    ))}
                    {sales.length === 0 && (
                      <div className="text-center py-12 text-gray-500 italic">No hay ventas registradas aún.</div>
                    )}
                  </div>
                </div>

                {/* Quick Actions & Low Stock */}
                <div className="space-y-6">
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                      <Zap size={20} className="text-yellow-500" /> Acciones Rápidas
                    </h3>
                    <div className="grid grid-cols-1 gap-3">
                      <button 
                        onClick={() => setView('pos')}
                        className="w-full flex items-center justify-center gap-2 p-3 bg-blue-600 hover:bg-blue-700 rounded-xl font-bold transition-colors"
                      >
                        <ShoppingCart size={18} /> Nueva Venta
                      </button>
                      <button 
                        onClick={() => setView('inventory')}
                        className="w-full flex items-center justify-center gap-2 p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl font-bold transition-colors"
                      >
                        <Plus size={18} /> Agregar Producto
                      </button>
                    </div>
                  </div>

                  {lowStockProducts.length > 0 && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6">
                      <h3 className="text-lg font-bold text-red-400 mb-4 flex items-center gap-2">
                        <AlertTriangle size={20} /> Stock Bajo
                      </h3>
                      <div className="space-y-3">
                        {lowStockProducts.slice(0, 3).map(p => (
                          <div key={p.id} className="flex justify-between items-center text-sm p-2 bg-red-500/5 rounded-lg border border-red-500/10">
                            <span className="text-gray-300 font-medium">{p.name}</span>
                            <span className="px-2 py-0.5 bg-red-500 text-white rounded text-[10px] font-bold">{p.stock}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {view === 'pos' && (
            <motion.div 
              key="pos"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-1 xl:grid-cols-12 gap-8"
            >
              {/* POS Header */}
              <div className="xl:col-span-12 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                  <h2 className="text-3xl font-bold tracking-tight">Terminal de Ventas</h2>
                  <p className="text-gray-400">Escanea o selecciona productos para la orden.</p>
                </div>
                <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
                  <form onSubmit={handleScan} className="relative w-full md:w-64">
                    <Zap className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-500" size={20} />
                    <input 
                      ref={scanInputRef}
                      type="text" 
                      placeholder="Escanear código..."
                      className="w-full pl-12 pr-4 py-3 bg-blue-600/10 border border-blue-500/30 rounded-xl focus:border-blue-500 outline-none transition-colors text-blue-400 placeholder:text-blue-400/50"
                      value={scanCode}
                      onChange={(e) => setScanCode(e.target.value)}
                      autoFocus
                    />
                  </form>
                  <div className="relative w-full md:w-80">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
                    <input 
                      type="text" 
                      placeholder="Buscar por nombre..."
                      className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:border-blue-500 outline-none transition-colors"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Products Grid */}
              <div className="xl:col-span-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredProducts.map(product => (
                  <div
                    key={product.id}
                    className="group bg-white/5 border border-white/10 rounded-2xl overflow-hidden hover:border-blue-500/50 transition-all duration-300"
                  >
                    <div className="h-48 bg-white/5 relative overflow-hidden">
                      {product.image ? (
                        <img src={product.image} alt={product.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-600">
                          <Candy size={48} strokeWidth={1} />
                        </div>
                      )}
                      <div className="absolute top-3 right-3 px-3 py-1 bg-black/60 backdrop-blur-md rounded-lg border border-white/10 text-sm font-bold text-blue-400">
                        ${product.price.toFixed(2)}
                      </div>
                    </div>
                    <div className="p-5">
                      <span className="text-[10px] font-bold uppercase text-blue-500 tracking-widest">{product.category}</span>
                      <h3 className="text-lg font-bold mt-1 mb-4 truncate">{product.name}</h3>
                      
                      <div className="flex justify-between items-center">
                        <div className="text-xs font-medium text-gray-400">
                          Stock: <span className={product.stock < 10 ? 'text-red-400 font-bold' : 'text-gray-300'}>{product.stock}</span>
                        </div>
                        <button
                          onClick={() => addToCart(product)}
                          disabled={product.stock <= 0}
                          className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl disabled:bg-gray-700 transition-colors"
                        >
                          <Plus size={20} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Cart Panel */}
              <div className="xl:col-span-4">
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 sticky top-8">
                  <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                    <ShoppingCart size={20} className="text-blue-500" /> Orden Actual
                  </h3>

                  <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 mb-6 custom-scrollbar">
                    {cart.length === 0 ? (
                      <div className="text-center py-12 border border-dashed border-white/10 rounded-xl">
                        <p className="text-gray-500 text-sm font-medium">El carrito está vacío</p>
                      </div>
                    ) : (
                      cart.map(item => (
                        <div key={item.product_id} className="flex justify-between items-center p-3 bg-white/[0.02] border border-white/5 rounded-xl">
                          <div className="flex-1">
                            <h4 className="font-bold text-sm truncate">{item.name}</h4>
                            <span className="text-xs text-gray-500">${item.price.toFixed(2)}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="flex items-center bg-black/40 rounded-lg border border-white/10 overflow-hidden">
                              <button onClick={() => updateCartQuantity(item.product_id, -1)} className="w-8 h-8 flex items-center justify-center hover:bg-white/5">-</button>
                              <span className="w-8 text-center text-xs font-bold">{item.quantity}</span>
                              <button onClick={() => updateCartQuantity(item.product_id, 1)} className="w-8 h-8 flex items-center justify-center hover:bg-white/5">+</button>
                            </div>
                            <button onClick={() => removeFromCart(item.product_id)} className="text-red-400 hover:text-red-300 transition-colors">
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="space-y-4 border-t border-white/10 pt-6">
                    {/* Customer Info */}
                    <div className="space-y-3">
                      <div className="flex gap-2 p-1 bg-white/5 rounded-xl border border-white/10">
                        <button 
                          onClick={() => setCustomerType('Consumidor Final')}
                          className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${customerType === 'Consumidor Final' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
                        >
                          Final
                        </button>
                        <button 
                          onClick={() => setCustomerType('Con Datos')}
                          className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${customerType === 'Con Datos' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
                        >
                          Con Datos
                        </button>
                      </div>

                      {customerType === 'Con Datos' && (
                        <div className="space-y-2">
                          <div className="relative">
                            <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                            <input 
                              type="text" 
                              placeholder="Nombre / Razón Social"
                              className="w-full pl-9 pr-3 py-2 bg-white/5 border border-white/10 rounded-lg text-xs focus:border-blue-500 outline-none"
                              value={customerName}
                              onChange={(e) => setCustomerName(e.target.value)}
                            />
                          </div>
                          <div className="relative">
                            <FileText size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                            <input 
                              type="text" 
                              placeholder="RUC / Cédula"
                              className="w-full pl-9 pr-3 py-2 bg-white/5 border border-white/10 rounded-lg text-xs focus:border-blue-500 outline-none"
                              value={customerId}
                              onChange={(e) => setCustomerId(e.target.value)}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Payment Method */}
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Método de Pago</p>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { id: 'Efectivo', icon: Banknote },
                          { id: 'Transferencia', icon: CreditCard },
                          { id: 'Deuna', icon: Smartphone }
                        ].map(m => (
                          <button 
                            key={m.id}
                            onClick={() => setPaymentMethod(m.id as any)}
                            className={`flex flex-col items-center gap-1 py-2 border rounded-xl transition-all ${paymentMethod === m.id ? 'bg-blue-600/10 border-blue-500 text-blue-400' : 'bg-white/5 border-white/10 text-gray-500 hover:text-gray-300'}`}
                          >
                            <m.icon size={16} />
                            <span className="text-[8px] font-bold uppercase">{m.id}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Totals */}
                    <div className="space-y-2 py-4 border-t border-white/10">
                      <div className="flex justify-between text-xs text-gray-400">
                        <span>Subtotal</span>
                        <span>${subtotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-xs text-blue-400 font-bold">
                        <span>IVA (15%)</span>
                        <span>${tax.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center pt-2">
                        <span className="font-bold text-lg">Total</span>
                        <span className="text-3xl font-bold text-blue-500">${total.toFixed(2)}</span>
                      </div>
                    </div>

                    <button 
                      onClick={handleCheckout}
                      disabled={cart.length === 0 || isProcessing}
                      className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-lg shadow-lg shadow-blue-600/20 transition-all disabled:bg-gray-800 disabled:text-gray-600"
                    >
                      {isProcessing ? 'Procesando...' : 'Cobrar Ahora'}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {view === 'inventory' && (
            <motion.div 
              key="inventory"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <header>
                <h2 className="text-3xl font-bold tracking-tight">Inventario</h2>
                <p className="text-gray-400 mt-1">Gestiona tus productos y preparados.</p>
              </header>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Add Product Form */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6 h-fit">
                  <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                    <Plus size={20} className="text-blue-500" /> Nuevo Producto
                  </h3>
                  <form onSubmit={handleAddProduct} className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-gray-500 uppercase">Nombre del Producto</label>
                      <input required className="w-full p-3 bg-white/5 border border-white/10 rounded-xl focus:border-blue-500 outline-none" value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-gray-500 uppercase">Código de Barras / SKU</label>
                      <input className="w-full p-3 bg-white/5 border border-white/10 rounded-xl focus:border-blue-500 outline-none" placeholder="Opcional" value={newProduct.code} onChange={e => setNewProduct({...newProduct, code: e.target.value})} />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-500 uppercase">Precio ($)</label>
                        <input required type="number" step="0.01" className="w-full p-3 bg-white/5 border border-white/10 rounded-xl focus:border-blue-500 outline-none" value={newProduct.price} onChange={e => setNewProduct({...newProduct, price: e.target.value})} />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-500 uppercase">Stock Inicial</label>
                        <input required type="number" className="w-full p-3 bg-white/5 border border-white/10 rounded-xl focus:border-blue-500 outline-none" value={newProduct.stock} onChange={e => setNewProduct({...newProduct, stock: e.target.value})} />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-gray-500 uppercase">Categoría</label>
                      <select className="w-full p-3 bg-white/5 border border-white/10 rounded-xl focus:border-blue-500 outline-none" value={newProduct.category} onChange={e => setNewProduct({...newProduct, category: e.target.value})}>
                        <option value="Dulces">Dulces</option>
                        <option value="Preparados">Preparados</option>
                        <option value="Chocolates">Chocolates</option>
                        <option value="Bebidas">Bebidas</option>
                        <option value="Snacks">Snacks</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-gray-500 uppercase">Imagen del Producto</label>
                      <div 
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full h-32 border-2 border-dashed border-white/10 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:bg-white/5 transition-colors overflow-hidden"
                      >
                        {newProduct.image ? (
                          <img src={newProduct.image} alt="Preview" className="w-full h-full object-cover" />
                        ) : (
                          <>
                            <Camera size={24} className="text-gray-500 mb-2" />
                            <span className="text-[10px] text-gray-500 font-bold uppercase">Subir Foto</span>
                          </>
                        )}
                      </div>
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        accept="image/*" 
                        onChange={handleImageUpload} 
                      />
                    </div>

                    <button className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold uppercase text-sm transition-all mt-4">
                      Guardar Producto
                    </button>
                  </form>
                </div>

                {/* Inventory List */}
                <div className="lg:col-span-2 bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                  <div className="p-6 border-b border-white/10">
                    <h3 className="text-lg font-bold">Lista de Productos</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-white/[0.02] text-[10px] font-bold uppercase text-gray-500 tracking-widest">
                          <th className="p-4">Producto</th>
                          <th className="p-4">Código</th>
                          <th className="p-4">Categoría</th>
                          <th className="p-4">Precio</th>
                          <th className="p-4">Stock</th>
                          <th className="p-4 text-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {products.map(product => (
                          <tr key={product.id} className="hover:bg-white/[0.02] transition-colors">
                            <td className="p-4">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-white/5 rounded-lg overflow-hidden flex items-center justify-center border border-white/10">
                                  {product.image ? (
                                    <img src={product.image} alt={product.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                  ) : (
                                    <Candy size={18} className="text-gray-600" />
                                  )}
                                </div>
                                <span className="font-bold text-sm">{product.name}</span>
                              </div>
                            </td>
                            <td className="p-4">
                              <span className="text-xs font-mono text-gray-500">{product.code || '-'}</span>
                            </td>
                            <td className="p-4">
                              <span className="px-2 py-1 bg-blue-500/10 text-blue-400 rounded text-[10px] font-bold uppercase">{product.category}</span>
                            </td>
                            <td className="p-4 font-bold text-sm">${product.price.toFixed(2)}</td>
                            <td className="p-4">
                              <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${product.stock < 10 ? 'bg-red-500' : 'bg-green-500'}`} />
                                <span className="text-sm font-medium">{product.stock}</span>
                              </div>
                            </td>
                            <td className="p-4 text-right">
                              <button onClick={() => handleDeleteProduct(product.id)} className="p-2 text-gray-500 hover:text-red-400 transition-colors">
                                <Trash2 size={18} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {view === 'history' && (
            <motion.div 
              key="history"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <header className="flex flex-col md:flex-row justify-between items-end gap-6">
                <div>
                  <h2 className="text-3xl font-bold tracking-tight">Historial de Ventas</h2>
                  <p className="text-gray-400 mt-1">Registro detallado de todas las transacciones.</p>
                </div>
                <div className="bg-blue-600/10 border border-blue-500/20 p-6 rounded-2xl">
                  <span className="block text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-1">Ingresos Totales</span>
                  <span className="text-4xl font-bold">${totalRevenue.toFixed(2)}</span>
                </div>
              </header>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {sales.map(sale => (
                  <div key={sale.id} className="bg-white/5 border border-white/10 p-6 rounded-2xl hover:border-blue-500/30 transition-all group">
                    <div className="flex justify-between items-start mb-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center">
                          <FileText className="text-blue-400" size={24} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-gray-500 uppercase">ID #{sale.id}</span>
                            <span className="px-2 py-0.5 bg-white/5 text-[8px] font-bold rounded border border-white/10 uppercase">{sale.payment_method}</span>
                          </div>
                          <h3 className="text-xl font-bold mt-1">{sale.customer_name}</h3>
                        </div>
                      </div>
                      <span className="text-2xl font-bold text-blue-400">${sale.total.toFixed(2)}</span>
                    </div>
                    
                    <div className="flex items-center gap-2 text-xs text-gray-500 mb-6">
                      <History size={14} />
                      {new Date(sale.date).toLocaleString()}
                    </div>

                    <div className="p-4 bg-white/[0.02] rounded-xl border border-white/5 mb-6">
                      <p className="text-[10px] font-bold text-gray-500 uppercase mb-2">Productos</p>
                      <p className="text-xs text-gray-300 italic">{sale.items}</p>
                    </div>

                    <button 
                      onClick={() => setShowInvoice(sale.id)}
                      className="w-full flex items-center justify-center gap-2 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl font-bold text-xs uppercase transition-colors"
                    >
                      <Download size={16} /> Ver Factura
                    </button>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Modern Invoice Modal */}
      <AnimatePresence>
        {showInvoice && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-xl z-50 flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-[#111114] w-full max-w-md border border-white/10 rounded-3xl overflow-hidden shadow-2xl"
            >
              <div className="bg-blue-600 p-8 text-white relative">
                <button onClick={() => setShowInvoice(null)} className="absolute top-6 right-6 p-2 hover:bg-white/10 rounded-lg transition-colors">
                  <X size={20} />
                </button>
                <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mb-4 backdrop-blur-md">
                  <Candy size={32} className="text-white" />
                </div>
                <h2 className="text-2xl font-bold tracking-tight">CANDY TECH</h2>
                <p className="text-blue-100 text-xs font-medium uppercase tracking-widest mt-1">Comprobante Electrónico</p>
              </div>
              
              <div className="p-8 space-y-6">
                <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-gray-500 border-b border-white/5 pb-4">
                  <div>
                    <p>Factura</p>
                    <p className="text-white text-lg mt-1">#{showInvoice}</p>
                  </div>
                  <div className="text-right">
                    <p>Fecha</p>
                    <p className="text-white text-lg mt-1">{new Date().toLocaleDateString()}</p>
                  </div>
                </div>

                <div className="space-y-3 bg-white/[0.02] p-4 rounded-2xl border border-white/5">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-gray-500 uppercase">Cliente</span>
                    <span className="text-xs font-bold">{sales.find(s => s.id === showInvoice)?.customer_name || customerName || 'Consumidor Final'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-gray-500 uppercase">RUC / CI</span>
                    <span className="text-xs font-bold">{sales.find(s => s.id === showInvoice)?.customer_id || customerId || '9999999999999'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-gray-500 uppercase">Pago</span>
                    <span className="text-blue-400 text-xs font-bold uppercase">{sales.find(s => s.id === showInvoice)?.payment_method || paymentMethod}</span>
                  </div>
                </div>

                <div className="space-y-2 px-2">
                  <div className="flex justify-between text-xs font-medium text-gray-400">
                    <span>Subtotal</span>
                    <span>${(sales.find(s => s.id === showInvoice)?.subtotal || subtotal).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-blue-400 font-bold">
                    <span>IVA (15%)</span>
                    <span>${(sales.find(s => s.id === showInvoice)?.tax || tax).toFixed(2)}</span>
                  </div>
                </div>

                <div className="bg-white/5 p-6 rounded-2xl flex justify-between items-center border border-white/10">
                  <span className="font-bold text-gray-300">Total</span>
                  <span className="text-3xl font-bold text-blue-500">
                    ${(sales.find(s => s.id === showInvoice)?.total || total).toFixed(2)}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => window.print()}
                    className="flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm transition-colors"
                  >
                    <Download size={16} /> Imprimir
                  </button>
                  <button 
                    onClick={() => setShowInvoice(null)}
                    className="py-3 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-xl font-bold text-sm transition-colors"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        
        body {
          font-family: 'Inter', sans-serif;
        }

        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }

        @media print {
          body { background: white !important; color: black !important; }
          nav, main, button, .fixed:not(.inset-0) { display: none !important; }
          .fixed.inset-0 { 
            display: flex !important; 
            position: absolute !important; 
            background: white !important; 
            padding: 0 !important;
            margin: 0 !important;
          }
          .bg-black/90 { background: transparent !important; backdrop-filter: none !important; }
          .rounded-3xl { border-radius: 0 !important; border: 1px solid #eee !important; box-shadow: none !important; }
          .bg-blue-600 { background: #f8f8f8 !important; color: black !important; border-bottom: 1px solid #eee !important; }
          .text-blue-100 { color: #666 !important; }
          .bg-white\\/5 { background: transparent !important; border: 1px solid #eee !important; }
          .text-blue-500, .text-blue-400 { color: black !important; }
          .shadow-2xl { box-shadow: none !important; }
          .bg-white\\/20 { background: #eee !important; }
          .text-white { color: black !important; }
        }
      `}</style>
    </div>
  );
}
