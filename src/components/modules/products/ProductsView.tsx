import React, { useState } from 'react';
import { Plus, Package, Edit, Check, X, RefreshCw } from 'lucide-react';
import { Product } from '../../../types/crm';
import { DataTable, Column } from '../../common/DataTable';
import { Modal } from '../../common/Modal';
import { Badge } from '../../common/Badge';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { crmService } from '../../../services/crmService';
import { ensureYalixProducts } from '../../../services/seedService';

interface ProductsViewProps {
  products: Product[];
  onRefresh: () => void;
  isLoading: boolean;
}

export function ProductsView({ products, onRefresh, isLoading }: ProductsViewProps) {
  const { currentUser, isAdmin } = useAuth();
  const { success, error } = useToast();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Partial<Product>>({
    name: '',
    description: '',
    category: '',
    unit: 'Metric Tons',
    active: true,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const handleOpenAdd = () => {
    setEditingProduct({
      name: '',
      description: '',
      category: 'Agro Products',
      unit: 'Metric Tons',
      active: true,
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (p: Product) => {
    setEditingProduct({ ...p });
    setIsModalOpen(true);
  };

  const handleSyncDefaultProducts = async () => {
    setIsSyncing(true);
    try {
      const added = await ensureYalixProducts(currentUser?.uid || 'user');
      success('Catalog Synced', `${added} missing products added to Firestore master.`);
      onRefresh();
    } catch (err: any) {
      error('Sync Failed', err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      error('Authentication Required', 'Please sign in with your authorized admin account to manage products.');
      return;
    }

    const trimmedName = editingProduct.name?.trim();
    if (!trimmedName) {
      error('Validation Error', 'Product Name is required.');
      return;
    }

    // Check for duplicate product names in existing catalog
    const duplicate = (products || []).find(
      (p) =>
        p.name.trim().toLowerCase() === trimmedName.toLowerCase() &&
        p.productId !== editingProduct.productId
    );
    if (duplicate) {
      error(
        'Duplicate Product',
        `A product named "${trimmedName}" already exists in the catalog (ID: ${duplicate.productId}).`
      );
      return;
    }

    setIsSaving(true);
    try {
      const saved = await crmService.saveProduct(
        {
          ...editingProduct,
          name: trimmedName,
        } as any,
        currentUser.uid,
        currentUser.email || undefined
      );
      success('Product Saved', `"${saved.name}" successfully saved in master catalog.`);
      setIsModalOpen(false);
      await onRefresh();
    } catch (err: any) {
      let displayError = err.message || 'Failed to save product to Firestore.';
      try {
        const parsed = JSON.parse(err.message);
        if (parsed.error) {
          displayError = parsed.error;
        }
      } catch {
        // Not a JSON string
      }
      if (displayError.toLowerCase().includes('client is offline')) {
        displayError =
          'The Firestore client is currently offline or reconnecting. Please check your internet connection and click Save to retry.';
      }
      error('Save Failed', displayError);
    } finally {
      setIsSaving(false);
    }
  };

  const columns: Column<Product>[] = [
    {
      key: 'name',
      label: 'Product Name',
      sortable: true,
      render: (item) => (
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700 shrink-0">
            <Package className="w-4 h-4" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-slate-900">{item.name}</span>
            <span className="text-[11px] text-slate-500 line-clamp-1">{item.description || '—'}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'category',
      label: 'Category',
      sortable: true,
      render: (item) => (
        <span className="text-xs font-medium text-slate-700 bg-slate-100 px-2.5 py-1 rounded-md">
          {item.category || 'General'}
        </span>
      ),
    },
    {
      key: 'unit',
      label: 'Commercial Unit',
      sortable: true,
      render: (item) => <span className="text-xs text-slate-600">{item.unit || 'Kg'}</span>,
    },
    {
      key: 'active',
      label: 'Catalog Status',
      sortable: true,
      render: (item) => (
        <Badge variant={item.active ? 'success' : 'slate'}>
          {item.active ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      sortable: false,
      align: 'right',
      render: (item) => (
        <button
          onClick={() => handleOpenEdit(item)}
          className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-slate-100 rounded-lg transition-colors"
          title="Edit product"
        >
          <Edit className="w-3.5 h-3.5" />
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
        <div>
          <h3 className="text-sm font-bold text-slate-900">
            YALIX Official Product Catalog Master
          </h3>
          <p className="text-xs text-slate-500">
            Editable master list for lead matching, campaign targeting, and quotes.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleSyncDefaultProducts}
            disabled={isSyncing}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs rounded-xl border border-slate-200 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>Verify YALIX Items</span>
          </button>
          <button
            onClick={handleOpenAdd}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>+ Add Product</span>
          </button>
        </div>
      </div>

      <DataTable
        data={products}
        columns={columns}
        keyField="productId"
        searchFields={['name', 'category', 'description', 'unit']}
        searchPlaceholder="Search product catalog..."
        exportFilename="yalix_products_master"
        isLoading={isLoading}
        emptyMessage="No products in catalog. Click 'Verify YALIX Items' to seed defaults."
      />

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingProduct.productId ? 'Edit Product' : 'Add Product to Master'}
        description="Provide details, standard packing unit, and active availability status."
        maxWidth="lg"
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 rounded-xl hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              form="product-form"
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-colors disabled:opacity-60"
            >
              {isSaving ? 'Saving...' : 'Save Product'}
            </button>
          </>
        }
      >
        <form id="product-form" onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Product Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={editingProduct.name || ''}
              onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
              placeholder="e.g. Cardamom, Egg Membrane Powder"
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
              <input
                type="text"
                value={editingProduct.category || ''}
                onChange={(e) =>
                  setEditingProduct({ ...editingProduct, category: e.target.value })
                }
                placeholder="e.g. Biomaterials, Agro Products, Spices"
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Unit of Measure</label>
              <input
                type="text"
                value={editingProduct.unit || ''}
                onChange={(e) => setEditingProduct({ ...editingProduct, unit: e.target.value })}
                placeholder="Metric Tons, Kilograms, Bales"
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Commercial Description & Specifications
            </label>
            <textarea
              rows={3}
              value={editingProduct.description || ''}
              onChange={(e) =>
                setEditingProduct({ ...editingProduct, description: e.target.value })
              }
              placeholder="Specification details, purity, applications, certifications..."
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="active-prod"
              checked={editingProduct.active ?? true}
              onChange={(e) =>
                setEditingProduct({ ...editingProduct, active: e.target.checked })
              }
              className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
            />
            <label htmlFor="active-prod" className="text-xs font-medium text-slate-700 cursor-pointer">
              Active in YALIX catalog (available for new leads & campaigns)
            </label>
          </div>
        </form>
      </Modal>
    </div>
  );
}
