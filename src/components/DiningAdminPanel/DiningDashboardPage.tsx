"use client";
import { useState, useEffect } from 'react';
import { Settings, CalendarCheck, Users, TrendingUp, Save, Clock, HelpCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useGetBusinessSettingsQuery, useGetBusinessBookingsQuery, useUpdateBusinessSettingsMutation } from '@/services/api';
import { useAppDispatch } from '@/lib/hooks';
import { loadFromStorage } from '@/features/auth/authSlice';
import { useAppSelector } from '@/lib/hooks';
import BusinessLandingPage from '@/components/DiningAdminPanel/BusinessLandingPage';

function BusinessDashboard() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);

  useEffect(() => { dispatch(loadFromStorage()); }, [dispatch]);

  const bizId = user?.business_id ?? '';

  const { data: settings, isLoading: settingsLoading } = useGetBusinessSettingsQuery(bizId, { skip: !bizId });
  const { data: bookingsData, isLoading: bookingsLoading } = useGetBusinessBookingsQuery(bizId, { skip: !bizId });
  const allBookings = bookingsData?.items ?? [];
  const [updateSettings, { isLoading: saving }] = useUpdateBusinessSettingsMutation();

  const [graceTime, setGraceTime] = useState<number | ''>(120);
  const [allocation, setAllocation] = useState<number | ''>(50);
  const [operatingHours, setOperatingHours] = useState({
    monday: { open: '09:00', close: '22:00', closed: false },
    tuesday: { open: '09:00', close: '22:00', closed: false },
    wednesday: { open: '09:00', close: '22:00', closed: false },
    thursday: { open: '09:00', close: '22:00', closed: false },
    friday: { open: '09:00', close: '23:00', closed: false },
    saturday: { open: '10:00', close: '23:00', closed: false },
    sunday: { open: '10:00', close: '21:00', closed: false },
  });

  const [mealPeriods, setMealPeriods] = useState({
    breakfast: { open: '08:00', close: '11:00', active: true },
    lunch: { open: '11:30', close: '16:00', active: true },
    dinner: { open: '17:00', close: '23:00', active: true },
  });

  useEffect(() => {
    if (settings) {
      setGraceTime(settings.grace_time_minutes ?? 120);
      setAllocation(settings.online_allocation_percentage ?? 50);
      if (settings.operating_hours) {
        const { meals, ...hoursOnly } = settings.operating_hours as any;
        setOperatingHours(hoursOnly);
        if (meals) {
          setMealPeriods(meals);
        }
      }
    }
  }, [settings]);

  const saveSettings = async () => {
    if (!bizId) return;
    try {
      await updateSettings({ 
        bizId, 
        body: { 
          grace_time_minutes: graceTime === '' ? 120 : graceTime, 
          online_allocation_percentage: allocation === '' ? 50 : allocation, 
          operating_hours: {
            ...operatingHours,
            meals: mealPeriods
          } as any
        } 
      }).unwrap();
      toast.success('Settings saved to database successfully!');
    } catch (err) {
      console.error(err);
    }
  };

  const handleHoursChange = (day: string, field: string, value: any) => {
    setOperatingHours((prev) => ({ ...prev, [day]: { ...prev[day as keyof typeof prev], [field]: value } }));
  };

  const recentBookings = allBookings.slice(0, 5);
  const isLoading = settingsLoading || bookingsLoading;

  if (isLoading || !user) return <div className="text-white p-10 text-center">Loading Business Dashboard...</div>;

  const gracePresets = [15, 30, 45, 60, 90, 120];

  return (
    <div className="max-w-7xl mx-auto animate-fadeIn">
      {/* Stats Cards Section */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
        <div className="glass-panel p-6 rounded-2xl border border-white/5 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-rose-500/10 rounded-lg text-rose-500">
              <CalendarCheck size={24} />
            </div>
            <h3 className="text-zinc-400 font-semibold text-sm">Total Bookings</h3>
          </div>
          <p className="text-3xl font-extrabold text-white">{allBookings.length}</p>
        </div>
        <div className="glass-panel p-6 rounded-2xl border border-white/5 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-blue-500/10 rounded-lg text-blue-500">
              <Users size={24} />
            </div>
            <h3 className="text-zinc-400 font-semibold text-sm">Active Status</h3>
          </div>
          <p className="text-xl font-extrabold text-green-500 mt-1 flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse"></span>
            Online
          </p>
        </div>
        <div className="glass-panel p-6 rounded-2xl border border-white/5 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-green-500/10 rounded-lg text-green-500">
              <TrendingUp size={24} />
            </div>
            <h3 className="text-zinc-400 font-semibold text-sm">Online Allocation</h3>
          </div>
          <p className="text-3xl font-extrabold text-white">{allocation}%</p>
        </div>
        <div className="glass-panel p-6 rounded-2xl border border-white/5 shadow-sm hover:shadow-md transition-all">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-purple-500/10 rounded-lg text-purple-500">
              <Settings size={24} />
            </div>
            <h3 className="text-zinc-400 font-semibold text-sm">Grace Period</h3>
          </div>
          <p className="text-3xl font-extrabold text-white">{graceTime} min</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Left Column: Global Settings */}
        <div className="glass-panel p-8 rounded-2xl border border-white/5 flex flex-col justify-between gap-8">
          <div className="space-y-8">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Settings className="text-rose-500" size={20} />
                <h3 className="text-xl font-bold text-white">Global Settings</h3>
              </div>
              <p className="text-zinc-400 text-sm">Configure automatic seat blocking guidelines and table distribution ceilings.</p>
            </div>

            <div className="space-y-6">
              {/* Grace Time Input & Presets */}
              <div className="p-6 bg-slate-50 dark:bg-zinc-900/30 border border-slate-200/50 dark:border-white/5 rounded-2xl space-y-3">
                <div className="flex justify-between items-center">
                  <label className="block text-sm font-bold text-slate-800 dark:text-zinc-200">Global Grace Time (Minutes)</label>
                  <span className="px-2 py-0.5 text-xs font-semibold bg-rose-500/10 text-rose-500 border border-rose-500/20 rounded-md">
                    {graceTime} mins
                  </span>
                </div>
                <input 
                  type="number" 
                  value={graceTime ?? ''} 
                  onChange={(e) => {
                    const val = e.target.value;
                    setGraceTime(val === '' ? '' : Number(val));
                  }} 
                  className="input-field" 
                  min="0"
                />
                
                {/* Presets */}
                <div className="space-y-1.5">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-zinc-500 block">Quick Presets</span>
                  <div className="flex flex-wrap gap-2">
                    {gracePresets.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setGraceTime(preset)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                          graceTime === preset
                            ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {preset}m
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-start gap-2 text-xs text-slate-500 dark:text-zinc-500 mt-2 bg-slate-100/50 dark:bg-black/10 p-3 rounded-xl border border-slate-200/20">
                  <HelpCircle size={14} className="mt-0.5 text-slate-400 shrink-0" />
                  <span>Tables will be blocked for this duration automatically. Allows a buffer for guests to arrive before releasing tables.</span>
                </div>
              </div>

              {/* Online Table Allocation */}
              <div className="p-6 bg-slate-50 dark:bg-zinc-900/30 border border-slate-200/50 dark:border-white/5 rounded-2xl space-y-4">
                <div className="flex justify-between items-center">
                  <label className="block text-sm font-bold text-slate-800 dark:text-zinc-200">Online Table Allocation (%)</label>
                  <span className="px-2.5 py-0.5 text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-md">
                    {allocation}% Allocated
                  </span>
                </div>

                <div className="flex items-center gap-4">
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    step="5"
                    value={allocation ?? 50} 
                    onChange={(e) => setAllocation(Number(e.target.value))} 
                    className="w-full h-2 bg-slate-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-rose-600 animate-none" 
                  />
                  <input 
                    type="number" 
                    min="0" 
                    max="100"
                    value={allocation ?? ''} 
                    onChange={(e) => {
                      const val = e.target.value;
                      setAllocation(val === '' ? '' : Math.min(100, Math.max(0, Number(val))));
                    }} 
                    className="w-20 rounded-lg px-3 py-1.5 text-sm font-semibold bg-white border border-slate-200 text-slate-800 focus:outline-none focus:ring-1 focus:ring-rose-500 focus:border-rose-500" 
                  />
                </div>

                <div className="flex items-start gap-2 text-xs text-slate-500 dark:text-zinc-500 bg-slate-100/50 dark:bg-black/10 p-3 rounded-xl border border-slate-200/20">
                  <HelpCircle size={14} className="mt-0.5 text-slate-400 shrink-0" />
                  <span>Maximum percentage of physical tables that can be booked online. Keep some inventory for walk-ins or manual bookings.</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Tips Box */}
          <div className="p-5 bg-rose-500/5 border border-rose-500/10 rounded-2xl flex gap-3">
            <AlertCircle className="text-rose-500 shrink-0 mt-0.5" size={18} />
            <div>
              <h4 className="text-xs font-bold text-rose-500 uppercase tracking-wider mb-1">Onboarding Tip</h4>
              <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                Ensure your operating times match when your kitchen is fully staffed. Setting allocation to 70% or more boosts your visibility on our customer platform.
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: Operating Hours */}
        <div className="glass-panel p-8 rounded-2xl border border-white/5 flex flex-col gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Clock className="text-rose-500" size={20} />
              <h3 className="text-xl font-bold text-white">Operating Hours</h3>
            </div>
            <p className="text-zinc-400 text-sm">Define your standard opening and closing times.</p>
          </div>

          <div className="space-y-3 max-h-[640px] overflow-y-auto pr-1 custom-scrollbar">
            {Object.entries(operatingHours).map(([day, hours]: [string, any]) => {
              const isClosed = hours.closed;
              return (
                <div key={day} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-slate-50 dark:bg-zinc-900/30 border border-slate-200/50 dark:border-white/5 rounded-2xl gap-4 hover:shadow-sm transition-all duration-200">
                  <div className="flex items-center gap-3">
                    <div className="w-24 capitalize text-sm font-bold text-slate-800 dark:text-zinc-200">{day}</div>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${
                      isClosed 
                        ? 'bg-rose-50 text-rose-600 border-rose-100' 
                        : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                    }`}>
                      {isClosed ? 'Closed' : 'Open'}
                    </span>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-4">
                    {/* Open/Closed Toggle */}
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-zinc-500">Open Status</span>
                      <button
                        type="button"
                        onClick={() => handleHoursChange(day, 'closed', !isClosed)}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          isClosed ? 'bg-slate-350' : 'bg-emerald-500'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            isClosed ? 'translate-x-0' : 'translate-x-5'
                          }`}
                        />
                      </button>
                    </div>

                    {!isClosed ? (
                      <div className="flex items-center gap-2">
                        {/* Open Time */}
                        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-1.5 shadow-sm focus-within:ring-1 focus-within:ring-rose-500/20 focus-within:border-rose-500">
                          <span className="text-[9px] text-slate-400 font-bold uppercase select-none">From</span>
                          <input 
                            type="time" 
                            value={hours.open} 
                            onChange={(e) => handleHoursChange(day, 'open', e.target.value)} 
                            className="bg-transparent text-xs text-slate-800 font-semibold focus:outline-none cursor-pointer border-0 p-0" 
                          />
                        </div>
                        <span className="text-slate-400 text-[10px] font-bold">to</span>
                        {/* Close Time */}
                        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-1.5 shadow-sm focus-within:ring-1 focus-within:ring-rose-500/20 focus-within:border-rose-500">
                          <span className="text-[9px] text-slate-400 font-bold uppercase select-none">To</span>
                          <input 
                            type="time" 
                            value={hours.close} 
                            onChange={(e) => handleHoursChange(day, 'close', e.target.value)} 
                            className="bg-transparent text-xs text-slate-800 font-semibold focus:outline-none cursor-pointer border-0 p-0" 
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="text-slate-400 text-xs font-semibold italic py-2 pr-4">
                        Closed for business
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Meal Periods Section */}
          <div className="border-t border-white/5 pt-6 mt-4 space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Clock className="text-rose-500" size={20} />
                <h3 className="text-xl font-bold text-white">Meal Periods Configuration</h3>
              </div>
              <p className="text-zinc-400 text-sm">Define custom hours for Breakfast, Lunch, and Dinner timeslots.</p>
            </div>

            <div className="space-y-3">
              {Object.entries(mealPeriods).map(([meal, period]: [string, any]) => {
                const isActive = period.active;
                return (
                  <div key={meal} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-slate-50 dark:bg-zinc-900/30 border border-slate-200/50 dark:border-white/5 rounded-2xl gap-4 hover:shadow-sm transition-all duration-200">
                    <div className="flex items-center gap-3">
                      <div className="w-24 capitalize text-sm font-bold text-slate-805 dark:text-zinc-200">{meal}</div>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${
                        !isActive 
                          ? 'bg-rose-50 text-rose-600 border-rose-100' 
                          : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                      }`}>
                        {isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-4">
                      {/* Active Toggle */}
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 dark:text-zinc-500">Active</span>
                        <button
                          type="button"
                          onClick={() => setMealPeriods(prev => ({
                            ...prev,
                            [meal]: { ...prev[meal as keyof typeof prev], active: !isActive }
                          }))}
                          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                            !isActive ? 'bg-slate-350' : 'bg-emerald-500'
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                              !isActive ? 'translate-x-0' : 'translate-x-5'
                            }`}
                          />
                        </button>
                      </div>

                      {isActive ? (
                        <div className="flex items-center gap-2">
                          {/* Open Time */}
                          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-1.5 shadow-sm focus-within:ring-1 focus-within:ring-rose-500/20 focus-within:border-rose-500">
                            <span className="text-[9px] text-slate-400 font-bold uppercase select-none">From</span>
                            <input 
                              type="time" 
                              value={period.open} 
                              onChange={(e) => setMealPeriods(prev => ({
                                ...prev,
                                [meal]: { ...prev[meal as keyof typeof prev], open: e.target.value }
                              }))} 
                              className="bg-transparent text-xs text-slate-800 font-semibold focus:outline-none cursor-pointer border-0 p-0" 
                            />
                          </div>
                          <span className="text-slate-400 text-[10px] font-bold">to</span>
                          {/* Close Time */}
                          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-1.5 shadow-sm focus-within:ring-1 focus-within:ring-rose-500/20 focus-within:border-rose-500">
                            <span className="text-[9px] text-slate-400 font-bold uppercase select-none">To</span>
                            <input 
                              type="time" 
                              value={period.close} 
                              onChange={(e) => setMealPeriods(prev => ({
                                ...prev,
                                [meal]: { ...prev[meal as keyof typeof prev], close: e.target.value }
                              }))} 
                              className="bg-transparent text-xs text-slate-800 font-semibold focus:outline-none cursor-pointer border-0 p-0" 
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="text-slate-400 text-xs font-semibold italic py-2 pr-4">
                          Disabled for bookings
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Common Save Settings Action Row */}
      <div className="flex justify-end p-6 bg-slate-50 dark:bg-zinc-900/25 rounded-2xl border border-slate-200/50 dark:border-white/5 shadow-sm">
        <button 
          onClick={saveSettings} 
          disabled={saving} 
          className="btn-primary flex items-center gap-2 text-sm px-6 py-3.5 font-bold shadow-lg hover:shadow-rose-600/20 hover:scale-[1.01] hover-lift transition-all"
        >
          <Save size={18} /> {saving ? 'Saving Settings...' : 'Save All Settings'}
        </button>
      </div>
    </div>
  );
}

export default function BusinessDashboardPage() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    dispatch(loadFromStorage());
    setCheckingAuth(false);
  }, [dispatch]);

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500 font-medium">
        Loading...
      </div>
    );
  }

  if (!user || user.role !== 'business_admin') {
    return <BusinessLandingPage />;
  }

  return <BusinessDashboard />;
}
