"use client";
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, Clock, MapPin, XCircle } from 'lucide-react';
import { useGetCustomerBookingsQuery, useCancelBookingMutation } from '@/services/api';
import { useAppSelector } from '@/lib/hooks';
import { loadFromStorage } from '@/features/auth/authSlice';
import { useAppDispatch } from '@/lib/hooks';

export default function CustomerDashboard() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);

  useEffect(() => {
    dispatch(loadFromStorage());
  }, [dispatch]);

  useEffect(() => {
    if (user === null) return; // still loading
    // After storage loaded, redirect if not a customer
    const stored = typeof window !== 'undefined' ? localStorage.getItem('user_customer') : null;
    if (!stored) { router.push('/login'); return; }
    const parsed = JSON.parse(stored);
    if (parsed.role !== 'customer') router.push('/');
  }, [user, router]);

  const customerId = user?.customer_id ?? '';
  const { data: bookings = [], isLoading } = useGetCustomerBookingsQuery(customerId, { skip: !customerId });
  const [cancelBooking] = useCancelBookingMutation();

  const handleCancel = async (id: string) => {
    if (!confirm('Are you sure you want to cancel this reservation?')) return;
    try {
      await cancelBooking({ id }).unwrap();
    } catch (err) {
      console.error(err);
    }
  };

  if (isLoading || !user) {
    return <div className="min-h-screen bg-background pt-24 text-center text-muted-foreground">Loading Dashboard...</div>;
  }

  const upcomingBookings = bookings.filter((b) => new Date(b.booking_time) > new Date() && b.status === 'CONFIRMED');
  const pastBookings = bookings.filter((b) => new Date(b.booking_time) <= new Date() || b.status !== 'CONFIRMED');

  return (
    <div className="min-h-screen bg-background pt-10">
      <div className="max-w-5xl mx-auto px-4">
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-foreground mb-2">Welcome back, {user?.email.split('@')[0]}!</h1>
          <p className="text-muted-foreground">Manage your reservations and view your dining history.</p>
        </div>

        <div className="space-y-10">
          {/* Upcoming Reservations */}
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center gap-2">
              <Calendar className="text-rose-500" size={24} /> Upcoming Reservations
            </h2>
            {upcomingBookings.length === 0 ? (
              <div className="glass-panel p-8 rounded-2xl text-center border border-border">
                <p className="text-muted-foreground mb-4">You have no upcoming reservations.</p>
                <button onClick={() => router.push('/')} className="btn-primary inline-block">Find a Table</button>
              </div>
            ) : (
              <div className="grid gap-4">
                {upcomingBookings.map((b) => (
                  <div key={b.id} className="glass-panel p-6 rounded-2xl border border-border flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-foreground">{b.business_name}</h3>
                      <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1"><MapPin size={16} /> {b.business_address || 'Address missing'}</div>
                        <div className="flex items-center gap-1"><Clock size={16} />
                          {new Date(b.booking_time).toLocaleString('en-US', {
                            weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                          })}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {b.table_number && (
                        <span className="px-3 py-1 bg-accent/40 border border-border rounded-lg text-sm text-muted-foreground">
                          Table {b.table_number}
                        </span>
                      )}
                      <button onClick={() => handleCancel(b.id)} className="flex items-center gap-2 text-sm text-rose-500 hover:text-rose-400 px-4 py-2 border border-rose-500/20 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer">
                        <XCircle size={16} /> Cancel
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Past/Cancelled Reservations */}
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">Dining History</h2>
            {pastBookings.length === 0 ? (
              <p className="text-muted-foreground text-sm">No past reservations.</p>
            ) : (
              <div className="grid gap-4">
                {pastBookings.map((b) => (
                  <div key={b.id} className="bg-accent/30 p-5 rounded-2xl border border-border flex items-center justify-between opacity-70">
                    <div>
                      <h3 className="font-medium text-foreground">{b.business_name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {new Date(b.booking_time).toLocaleDateString()} at {new Date(b.booking_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <div>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium border ${
                        b.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                        b.status === 'CANCELLED' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                        'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'
                      }`}>{b.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
