"use client";
import { useState, useEffect } from 'react';
import { Plus, ArrowUpDown, ChevronUp, ChevronDown, Search } from 'lucide-react';
import { toast } from 'sonner';
import { useGetBusinessBookingsQuery, useCancelBookingMutation, useCreateBookingMutation } from '@/services/api';
import { useAppDispatch, useAppSelector } from '@/lib/hooks';
import { loadFromStorage } from '@/features/auth/authSlice';
import PhoneInput from '@/components/PhoneInput';
import { isValidPhone } from '@/lib/validation';

export default function BookingsManager() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  useEffect(() => { dispatch(loadFromStorage()); }, [dispatch]);

  const bizId = user?.business_id ?? '';
  const { data: bookings = [], isLoading } = useGetBusinessBookingsQuery(bizId, { skip: !bizId });
  const [cancelBooking] = useCancelBookingMutation();
  const [createBooking, { isLoading: isAddingWalkIn }] = useCreateBookingMutation();

  const [showModal, setShowModal] = useState(false);
  const [walkInName, setWalkInName] = useState('Walk-in Guest');
  const [walkInPhone, setWalkInPhone] = useState('');
  const [walkInPhoneValid, setWalkInPhoneValid] = useState(true);
  const [walkInGuests, setWalkInGuests] = useState('2');

  // DataTable States
  const [searchTerm, setSearchTerm] = useState('');
  const [sortColumn, setSortColumn] = useState<string>('booking_time');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const handleCancelBooking = async (id: string) => {
    if (!confirm('Are you sure you want to cancel this booking?')) return;
    try { await cancelBooking({ id }).unwrap(); } catch (err) { console.error(err); }
  };

  const handleAddWalkIn = async () => {
    if (walkInPhone.trim() && !isValidPhone(walkInPhone)) {
      toast.error('Guest phone must be 9–12 digits (numbers only)');
      return;
    }
    try {
      await createBooking({
        business_id: bizId,
        customer_name: walkInName,
        customer_phone: walkInPhone.trim() || '0000000000',
        booking_time: new Date().toISOString(),
        booking_source: 'WALK_IN',
        guests: Number(walkInGuests),
      }).unwrap();
      setShowModal(false);
    } catch {
      toast.error('Failed to add walk-in. Check table availability.');
    }
  };

  // DataTable Sorting Toggle
  const toggleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
    setCurrentPage(1);
  };

  const renderSortHeader = (column: string, label: string) => {
    const isSorted = sortColumn === column;
    return (
      <th 
        onClick={() => toggleSort(column)} 
        className="py-4 px-6 text-xs uppercase tracking-wider font-semibold text-zinc-400 cursor-pointer select-none hover:text-white transition-colors"
      >
        <div className="flex items-center gap-1.5">
          <span>{label}</span>
          {isSorted ? (
            sortDirection === 'asc' ? <ChevronUp size={14} className="text-rose-500 shrink-0" /> : <ChevronDown size={14} className="text-rose-500 shrink-0" />
          ) : (
            <ArrowUpDown size={12} className="text-zinc-600 opacity-50 hover:opacity-100 shrink-0" />
          )}
        </div>
      </th>
    );
  };

  // 1. Filter bookings based on search
  const filteredBookings = bookings.filter((b) => {
    const term = searchTerm.toLowerCase();
    return (
      (b.customer_name || '').toLowerCase().includes(term) ||
      (b.customer_phone || '').toLowerCase().includes(term) ||
      (b.status || '').toLowerCase().includes(term) ||
      (b.booking_source || '').toLowerCase().includes(term) ||
      (b.table_number || '').toString().includes(term)
    );
  });

  // 2. Sort bookings
  const sortedBookings = [...filteredBookings].sort((a, b) => {
    let aVal: any = a[sortColumn as keyof typeof a];
    let bVal: any = b[sortColumn as keyof typeof b];

    if (sortColumn === 'customer_name') {
      aVal = a.customer_name || '';
      bVal = b.customer_name || '';
    } else if (sortColumn === 'booking_time') {
      aVal = new Date(a.booking_time).getTime();
      bVal = new Date(b.booking_time).getTime();
    } else if (sortColumn === 'table_number') {
      aVal = Number(a.table_number) || 0;
      bVal = Number(b.table_number) || 0;
    }

    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  // 3. Paginate bookings
  const totalEntries = sortedBookings.length;
  const totalPages = Math.ceil(totalEntries / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedBookings = sortedBookings.slice(startIndex, startIndex + pageSize);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Page Header Area */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight">Active Reservations</h2>
          <p className="text-sm text-zinc-400 mt-1">Review, monitor, and check-in your venue's table bookings.</p>
        </div>
        <button 
          onClick={() => setShowModal(true)} 
          className="btn-primary flex items-center justify-center gap-2 rounded-xl px-5 py-3 hover-lift text-sm font-semibold shadow-lg shadow-rose-600/10"
        >
          <Plus size={18} />
          <span>Add Walk-in</span>
        </button>
      </div>

      {/* DataTable Top Bar */}
      <div className="glass-panel px-6 py-4 rounded-2xl border border-white/5 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-2 text-sm text-zinc-400">
          <span>Show</span>
          <select 
            value={pageSize} 
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="bg-zinc-800 border border-white/10 rounded-xl px-3 py-1.5 text-white focus:outline-none focus:border-rose-500 text-xs font-semibold cursor-pointer"
          >
            {[5, 10, 25, 50].map((size) => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
          <span>entries</span>
        </div>
        <div className="relative w-full md:max-w-xs">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
          <input 
            type="text" 
            placeholder="Search bookings..." 
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full bg-zinc-900/50 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-all"
          />
        </div>
      </div>

      {/* DataTable Container */}
      <div className="glass-panel rounded-2xl border border-white/5 overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 bg-white/[0.02]">
                <th className="py-4 px-6 text-xs uppercase tracking-wider font-semibold text-zinc-400 w-16">#</th>
                {renderSortHeader('customer_name', 'Customer')}
                {renderSortHeader('booking_time', 'Date & Time')}
                {renderSortHeader('booking_source', 'Source')}
                {renderSortHeader('table_number', 'Assigned Table')}
                {renderSortHeader('status', 'Status')}
                <th className="py-4 px-6 text-xs uppercase tracking-wider font-semibold text-zinc-400 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {paginatedBookings.map((booking, index) => {
                const serialNo = startIndex + index + 1;
                return (
                  <tr key={booking.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-4 px-6 text-sm font-semibold text-zinc-500">{serialNo}</td>
                    <td className="py-4 px-6">
                      <div className="font-semibold text-white text-sm">{booking.customer_name}</div>
                      <div className="text-xs text-zinc-500 mt-0.5">{booking.customer_phone}</div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="text-sm font-semibold text-white">
                        {new Date(booking.booking_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                      <div className="text-xs text-zinc-500 mt-0.5">
                        {new Date(booking.booking_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide ${
                        booking.booking_source === 'ONLINE' 
                          ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' 
                          : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                      }`}>
                        {booking.booking_source}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      {booking.table_number ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-zinc-800 text-zinc-300 border border-white/10">
                          Table {booking.table_number}
                        </span>
                      ) : (
                        <span className="text-zinc-600 text-xs italic font-medium">Unassigned</span>
                      )}
                    </td>
                    <td className="py-4 px-6">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide ${
                        booking.status === 'CONFIRMED' 
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                          : booking.status === 'CANCELLED' 
                          ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' 
                          : 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20'
                      }`}>
                        {booking.status}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      {booking.status === 'CONFIRMED' && (
                        <button 
                          onClick={() => handleCancelBooking(booking.id)} 
                          className="inline-flex items-center px-3 py-1.5 rounded-xl border border-rose-500/30 text-rose-500 hover:text-white hover:bg-rose-600 hover:border-rose-600 text-xs font-semibold transition-all active:scale-95 cursor-pointer"
                        >
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {paginatedBookings.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-zinc-500 font-medium italic">
                    No bookings yet.
                  </td>
                </tr>
              )}
              {isLoading && (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-zinc-500 font-medium">
                    Loading bookings...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* DataTable Footer / Pagination */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 px-6 py-4 border-t border-white/5 bg-white/[0.01]">
          <div className="text-xs text-zinc-400 font-medium">
            {totalEntries > 0 ? (
              <span>
                Showing <span className="text-white font-semibold">{startIndex + 1}</span> to{' '}
                <span className="text-white font-semibold">{Math.min(startIndex + pageSize, totalEntries)}</span> of{' '}
                <span className="text-white font-semibold">{totalEntries}</span> entries
              </span>
            ) : (
              <span>Showing 0 to 0 of 0 entries</span>
            )}
          </div>
          
          {totalPages > 1 && (
            <div className="flex items-center gap-1.5">
              <button 
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                className="bg-zinc-900/60 border border-white/5 rounded-xl px-3.5 py-2 text-xs font-bold text-zinc-400 hover:text-white hover:border-white/20 transition-all disabled:opacity-40 disabled:hover:text-zinc-400 disabled:hover:border-white/5 cursor-pointer disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }).map((_, i) => {
                  const pageNum = i + 1;
                  const active = currentPage === pageNum;
                  return (
                    <button 
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`w-8 h-8 rounded-xl text-xs font-extrabold border transition-all cursor-pointer ${active 
                        ? 'bg-rose-600 border-rose-600 text-white shadow-md shadow-rose-600/10'
                        : 'bg-zinc-900/40 border-white/5 text-zinc-400 hover:text-white hover:border-white/20'}`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>
              <button 
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                className="bg-zinc-900/60 border border-white/5 rounded-xl px-3.5 py-2 text-xs font-bold text-zinc-400 hover:text-white hover:border-white/20 transition-all disabled:opacity-40 disabled:hover:text-zinc-400 disabled:hover:border-white/5 cursor-pointer disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="glass-panel max-w-md w-full p-6 rounded-2xl border border-white/10 relative shadow-2xl">
            <button 
              onClick={() => setShowModal(false)} 
              className="absolute top-5 right-5 w-8 h-8 rounded-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/5 transition-all"
            >
              ✕
            </button>
            <h2 className="text-xl font-bold mb-5 text-white tracking-tight">Add Walk-in</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">Guest Name (Optional)</label>
                <input 
                  type="text" 
                  value={walkInName} 
                  onChange={(e) => setWalkInName(e.target.value)} 
                  className="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-all placeholder:text-zinc-650"
                  placeholder="e.g. John Doe"
                />
              </div>
              <PhoneInput
                label="Guest Phone (Optional)"
                labelClassName="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2"
                variant="dark"
                value={walkInPhone}
                onChange={setWalkInPhone}
                onValidChange={setWalkInPhoneValid}
                required={false}
                placeholder="9876543210"
                helperText="Leave empty or enter 9–12 digits"
              />
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">Party Size</label>
                <input 
                  type="number" 
                  value={walkInGuests} 
                  onChange={(e) => setWalkInGuests(e.target.value)} 
                  className="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-all"
                  min="1" 
                  max="20" 
                />
              </div>
              <button 
                onClick={handleAddWalkIn} 
                disabled={isAddingWalkIn || (walkInPhone.trim() !== '' && !walkInPhoneValid)} 
                className="btn-primary w-full mt-4 disabled:opacity-50 flex items-center justify-center gap-2 rounded-xl py-3 hover-lift text-sm font-semibold shadow-lg shadow-rose-600/10"
              >
                {isAddingWalkIn ? 'Adding...' : 'Seat Walk-in Now'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
