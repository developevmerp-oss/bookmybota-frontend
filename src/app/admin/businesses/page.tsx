"use client";
import { useMemo, useState } from 'react';
import { Building2, CheckCircle, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useGetBusinessesQuery, useGetBusinessTypesQuery, useRegisterBusinessMutation } from '@/services/api';

type PartnerType = 'dining' | 'event';

export default function BusinessesPage() {
  const { data: businesses = [], isLoading } = useGetBusinessesQuery();
  const { data: businessTypes = [] } = useGetBusinessTypesQuery();
  const [registerBusiness, { isLoading: isOnboarding }] = useRegisterBusinessMutation();

  const [showModal, setShowModal] = useState(false);
  const [partnerType, setPartnerType] = useState<PartnerType>('dining');
  const [businessName, setBusinessName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [description, setDescription] = useState('');
  const [typeId, setTypeId] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [onboardStatus, setOnboardStatus] = useState<string | null>(null);

  const filteredTypes = useMemo(() => {
    if (!businessTypes.length) return [];
    if (partnerType === 'event') {
      const eventTypes = businessTypes.filter(
        (t) => t.module_key === 'event' || t.slug === 'event' || !!t.parent_type_id
      );
      // Prefer subtypes (Comedy/Music/Concert); fall back to Event parent
      const subtypes = eventTypes.filter((t) => t.parent_type_id);
      return subtypes.length ? subtypes : eventTypes;
    }
    return businessTypes.filter(
      (t) => !t.module_key || t.module_key === 'dining'
    );
  }, [businessTypes, partnerType]);

  const resetForm = () => {
    setBusinessName('');
    setAddress('');
    setPhone('');
    setDescription('');
    setTypeId('');
    setAdminEmail('');
    setAdminPassword('');
    setPartnerType('dining');
  };

  const handleOnboard = async () => {
    setOnboardStatus('loading');
    try {
      const defaultType =
        filteredTypes[0]?.id ??
        businessTypes[0]?.id ??
        1;
      await registerBusiness({
        business_name: businessName,
        address,
        phone,
        description,
        type_id: parseInt(typeId || String(defaultType), 10),
        admin_email: adminEmail,
        admin_password: adminPassword,
        partner_type: partnerType,
      }).unwrap();
      setOnboardStatus('success');
      toast.success(
        partnerType === 'event'
          ? 'Event organizer registered successfully!'
          : 'Business registered successfully!'
      );
      setTimeout(() => {
        setShowModal(false);
        setOnboardStatus(null);
        resetForm();
      }, 2000);
    } catch {
      setOnboardStatus('error');
      toast.error('Failed to register');
    }
  };

  if (isLoading) return <div className="text-white p-10 text-center">Loading Businesses...</div>;

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold text-white">Registered Businesses</h2>
          <p className="text-zinc-400">Manage dining venues and event organizers on the platform.</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
          <Building2 size={18} /> Onboard Partner
        </button>
      </div>

      <div className="glass-panel rounded-2xl border border-white/5 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-zinc-900/50 border-b border-white/5 text-zinc-400 text-sm">
            <tr>
              <th className="px-6 py-4 font-medium">Business Name</th>
              <th className="px-6 py-4 font-medium">Module</th>
              <th className="px-6 py-4 font-medium">Type</th>
              <th className="px-6 py-4 font-medium">Location</th>
              <th className="px-6 py-4 font-medium">Admin</th>
              <th className="px-6 py-4 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {businesses.map((biz) => (
              <tr key={biz.id} className="hover:bg-white/5 transition-colors cursor-pointer">
                <td className="px-6 py-4 font-medium text-white">{biz.name}</td>
                <td className="px-6 py-4">
                  <span
                    className={`px-2 py-1 rounded-md text-xs font-bold uppercase tracking-wider border ${
                      biz.module_key === 'event' || biz.admin_role === 'event_admin'
                        ? 'bg-violet-500/10 text-violet-400 border-violet-500/20'
                        : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    }`}
                  >
                    {biz.module_key === 'event' || biz.admin_role === 'event_admin'
                      ? 'Event'
                      : biz.module_name || 'Dining'}
                  </span>
                </td>
                <td className="px-6 py-4 text-zinc-400">{biz.type_name || 'Unspecified'}</td>
                <td className="px-6 py-4 text-zinc-400">{biz.address}</td>
                <td className="px-6 py-4 text-zinc-400 text-sm">
                  {biz.admin_email || '—'}
                  {biz.admin_role ? (
                    <div className="text-xs text-zinc-500">{biz.admin_role}</div>
                  ) : null}
                </td>
                <td className="px-6 py-4">
                  <span className="flex items-center gap-1 text-green-400 text-sm">
                    <CheckCircle size={14} /> Active
                  </span>
                </td>
              </tr>
            ))}
            {businesses.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-10 text-zinc-500">
                  No businesses found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="glass-panel max-w-lg w-full p-6 rounded-2xl border border-white/10 relative shadow-2xl my-8">
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-white"
            >
              ✕
            </button>
            <h2 className="text-2xl font-bold mb-2 text-white">Onboard Partner</h2>
            <p className="text-zinc-400 mb-6">
              Create a dining venue or event organizer and their login credentials.
            </p>

            {onboardStatus === 'success' ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle size={32} />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Partner Onboarded!</h3>
                <p className="text-zinc-400 mb-6">
                  They can now log in using the credentials you created.
                </p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">
                    Partner type
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setPartnerType('dining');
                        setTypeId('');
                      }}
                      className={`px-4 py-3 rounded-xl border text-sm font-medium transition-colors ${
                        partnerType === 'dining'
                          ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                          : 'text-zinc-400 border-white/10 hover:bg-white/5'
                      }`}
                    >
                      Dining venue
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPartnerType('event');
                        setTypeId('');
                      }}
                      className={`px-4 py-3 rounded-xl border text-sm font-medium transition-colors ${
                        partnerType === 'event'
                          ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                          : 'text-zinc-400 border-white/10 hover:bg-white/5'
                      }`}
                    >
                      Event organizer
                    </button>
                  </div>
                  <p className="text-xs text-zinc-500 mt-2">
                    {partnerType === 'event'
                      ? 'Creates an event_admin account for your project partner.'
                      : 'Creates a business_admin account for the dining portal.'}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">
                    {partnerType === 'event' ? 'Event category' : 'Venue Type'}
                  </label>
                  <select
                    value={typeId}
                    onChange={(e) => setTypeId(e.target.value)}
                    className="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-rose-500 appearance-none"
                  >
                    <option value="">Select type...</option>
                    {filteredTypes.map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">
                    {partnerType === 'event' ? 'Organizer Name' : 'Business Name'}
                  </label>
                  <input
                    type="text"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    className="input-field"
                    placeholder={
                      partnerType === 'event' ? 'E.g., LiveWire Productions' : 'E.g., The Sapphire Room'
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">Address</label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="input-field"
                    placeholder="City / area"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">Phone Number</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="input-field"
                    placeholder="+1 (555) 123-4567"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">Description</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-rose-500 transition-all"
                    placeholder="Brief description..."
                    rows={3}
                  />
                </div>
                <hr className="border-white/10 my-4" />
                <h3 className="text-lg font-medium text-white mb-2">Admin Credentials</h3>
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">
                    Admin Login Email
                  </label>
                  <input
                    type="email"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    className="input-field"
                    placeholder="admin@example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">
                    Temporary Password
                  </label>
                  <input
                    type="text"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    className="input-field"
                    placeholder="Auto-generate or type..."
                  />
                </div>
              </div>
            )}

            {onboardStatus !== 'success' && (
              <div className="mt-6 pt-4 border-t border-white/5">
                <button
                  onClick={handleOnboard}
                  disabled={!businessName || !adminEmail || !adminPassword || isOnboarding}
                  className="btn-primary w-full disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Plus size={18} />{' '}
                  {isOnboarding
                    ? 'Creating...'
                    : partnerType === 'event'
                      ? 'Create Event Organizer'
                      : 'Create Business'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
