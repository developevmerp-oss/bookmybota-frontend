"use client";
import { useState, useEffect } from 'react';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useGetTablesQuery, useAddTableMutation, useUpdateTableMutation, useDeleteTableMutation } from '@/services/api';
import { useAppDispatch, useAppSelector } from '@/lib/hooks';
import { loadFromStorage } from '@/features/auth/authSlice';

export default function TableManager() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  useEffect(() => { dispatch(loadFromStorage()); }, [dispatch]);

  const bizId = user?.business_id ?? '';
  const { data: tables = [], isLoading } = useGetTablesQuery(bizId, { skip: !bizId });
  const [addTable] = useAddTableMutation();
  const [updateTable] = useUpdateTableMutation();
  const [deleteTable] = useDeleteTableMutation();

  const [showModal, setShowModal] = useState(false);
  const [tableNumber, setTableNumber] = useState('');
  const [capacity, setCapacity] = useState('4');

  const handleAddTable = async () => {
    if (!bizId) return;
    try {
      await addTable({ bizId, table_number: tableNumber, capacity: parseInt(capacity) }).unwrap();
      setShowModal(false);
      setTableNumber('');
      setCapacity('4');
    } catch {
      toast.error('Failed to add table');
    }
  };

  const handleToggleActive = async (tableId: string, currentStatus: boolean) => {
    if (!bizId) return;
    try { await updateTable({ bizId, tableId, is_active: !currentStatus }).unwrap(); } catch (err) { console.error(err); }
  };

  const handleDeleteTable = async (tableId: string) => {
    if (!bizId || !confirm('Are you sure you want to delete this table?')) return;
    try { await deleteTable({ bizId, tableId }).unwrap(); } catch (err) { console.error(err); }
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold text-white">Interactive Table Management</h2>
          <p className="text-zinc-400">Add physical tables and toggle them active/inactive.</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary">Add Table</button>
      </div>

      {isLoading ? (
        <p className="text-zinc-400 text-center py-10">Loading your floor plan...</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {tables.map((t) => (
            <div key={t.id} className={`glass-panel p-6 rounded-2xl border ${t.is_active ? 'border-white/5' : 'border-rose-500/20 opacity-60'} text-center transition-colors relative overflow-hidden group`}>
              <div className={`absolute top-0 left-0 w-full h-1 ${t.is_active ? 'bg-rose-500' : 'bg-zinc-600'}`} />
              <button onClick={() => handleDeleteTable(t.id)} className="absolute top-3 right-3 text-zinc-500 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity" title="Delete Table">
                <Trash2 size={16} />
              </button>
              <h3 className="text-xl font-bold text-white mb-1 mt-2">{t.table_number}</h3>
              <p className="text-zinc-400 text-sm mb-4">Capacity: {t.capacity} Guests</p>
              <button onClick={() => handleToggleActive(t.id, t.is_active)} className={`text-xs font-bold px-3 py-1 rounded-md border ${t.is_active ? 'text-green-400 border-green-500/30 hover:bg-green-500/10' : 'text-zinc-400 border-zinc-500/30 hover:bg-zinc-500/10'} transition-colors`}>
                {t.is_active ? 'ACTIVE' : 'INACTIVE'}
              </button>
            </div>
          ))}
          {tables.length === 0 && <div className="col-span-4 text-center py-10 text-zinc-500">No tables configured. Add one!</div>}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel max-w-md w-full p-6 rounded-2xl border border-white/10 relative shadow-2xl">
            <button onClick={() => setShowModal(false)} className="absolute top-4 right-4 text-zinc-400 hover:text-white">✕</button>
            <h2 className="text-2xl font-bold mb-6 text-white">Add Physical Table</h2>
            <div className="space-y-4">
              <div><label className="block text-sm font-medium text-zinc-400 mb-2">Table Identifier</label><input type="text" value={tableNumber} onChange={(e) => setTableNumber(e.target.value)} className="input-field" placeholder="E.g., T-12, Bar-1" /></div>
              <div><label className="block text-sm font-medium text-zinc-400 mb-2">Seating Capacity</label><input type="number" value={capacity} onChange={(e) => setCapacity(e.target.value)} className="input-field" /></div>
              <button onClick={handleAddTable} disabled={!tableNumber || !capacity} className="btn-primary w-full mt-4 disabled:opacity-50 flex items-center justify-center">
                Create Table
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
