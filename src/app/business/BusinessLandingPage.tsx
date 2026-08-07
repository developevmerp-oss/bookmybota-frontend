"use client";
import { useState } from 'react';
import Link from 'next/link';
import { UtensilsCrossed, CheckCircle, Plus, Loader2 } from 'lucide-react';
import { useGetBusinessTypesQuery, useRegisterBusinessMutation } from '@/services/api';
import PartnerTypeFields, { resolvePartnerFromParentId } from '@/components/PartnerTypeFields';
import PhoneInput from '@/components/PhoneInput';
import PasswordInput from '@/components/PasswordInput';
import { isValidPhone, isValidPassword } from '@/lib/validation';

export default function BusinessLandingPage() {
  const { data: businessTypes = [] } = useGetBusinessTypesQuery();
  const [registerBusiness, { isLoading: isOnboarding }] = useRegisterBusinessMutation();

  const [showModal, setShowModal] = useState(false);
  const [businessName, setBusinessName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [description, setDescription] = useState('');
  const [parentTypeId, setParentTypeId] = useState('');
  const [venueTypeId, setVenueTypeId] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [phoneValid, setPhoneValid] = useState(false);
  const [passwordValid, setPasswordValid] = useState(false);
  const [onboardStatus, setOnboardStatus] = useState<string | null>(null);

  const selectedParent = businessTypes.find((t) => String(t.id) === parentTypeId);
  const isEventParent = selectedParent?.module_key === 'event';

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidPhone(phone) || !isValidPassword(adminPassword)) return;
    setOnboardStatus('loading');
    try {
      const eventPartner = resolvePartnerFromParentId(businessTypes, parentTypeId);
      await registerBusiness({
        business_name: businessName,
        address,
        phone,
        description,
        type_id: eventPartner
          ? eventPartner.type_id
          : parseInt(venueTypeId, 10),
        admin_email: adminEmail,
        admin_password: adminPassword,
        partner_type: eventPartner ? 'event' : 'dining',
      }).unwrap();
      setOnboardStatus('success');
      setTimeout(() => {
        setShowModal(false);
        setOnboardStatus(null);
        setBusinessName(''); setAddress(''); setPhone('');
        setDescription(''); setAdminEmail(''); setAdminPassword('');
        setParentTypeId(''); setVenueTypeId('');
      }, 2000);
    } catch {
      setOnboardStatus('error');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* ── Header ── */}
      <header className="fixed top-0 w-full z-50 bg-white/95 backdrop-blur-md border-b border-slate-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="bg-rose-600 p-2 rounded-lg group-hover:scale-105 transition-transform shadow-[0_0_15px_rgba(225,29,72,0.5)]">
                <UtensilsCrossed size={24} className="text-white" />
              </div>
              <span className="text-xl font-bold tracking-tight text-slate-800">Book My Bota</span>
            </Link>
            <div className="flex gap-4 items-center">
              <Link href="/login" className="px-5 py-2 rounded-full border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50 hover:text-slate-900 transition-all text-sm">
                Login
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* ── Hero Section ── */}
      <div 
        className="relative flex items-center justify-center flex-1 min-h-screen pt-20"
        style={{ background: "linear-gradient(135deg, #18181b 0%, #27272a 50%, #09090b 100%)" }}
      >
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-30" 
          style={{ backgroundImage: "url(https://images.unsplash.com/photo-1544025162-d76694265947?w=1600&q=80)" }}
        />
        <div className="absolute inset-0 bg-black/40" />

        <div className="relative z-10 max-w-4xl mx-auto px-4 text-center flex flex-col items-center">
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight leading-tight mb-6" style={{ color: '#ffffff' }}>
            Partner with Book My Bota <br />
            and grow your business
          </h1>

          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-2 mb-8 backdrop-blur-md">
            <span className="w-5 h-5 rounded-full bg-blue-500 text-white text-xs font-bold flex items-center justify-center">%</span>
            <span className="text-xs font-medium" style={{ color: '#ffffff' }}>
              0% commission for 1st month! Only valid for new restaurant partners
            </span>
          </div>

          {/* CTA */}
          <button 
            onClick={() => setShowModal(true)} 
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-8 py-4 rounded-xl text-base shadow-xl hover:scale-105 active:scale-95 transition-all duration-300"
          >
            Register your Business
          </button>
        </div>
      </div>

      {/* ── Registration Modal ── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white max-w-3xl w-full p-6 md:p-8 rounded-3xl relative shadow-2xl border border-slate-100 my-8">
            <button 
              onClick={() => setShowModal(false)} 
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-800 text-lg transition-colors font-bold"
            >
              ✕
            </button>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Register Business</h2>
            <p className="text-slate-500 text-sm mb-6">Create your business profile and generate your login credentials.</p>

            {onboardStatus === 'success' ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-green-100 text-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle size={32} />
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">Registration Successful!</h3>
                <p className="text-slate-500">Your venue has been registered. You can now log in using the credentials you created.</p>
              </div>
            ) : (
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <PartnerTypeFields
                    partnerType="combined"
                    businessTypes={businessTypes}
                    parentTypeId={parentTypeId}
                    venueTypeId={venueTypeId}
                    onParentTypeIdChange={setParentTypeId}
                    onVenueTypeIdChange={setVenueTypeId}
                    variant="light"
                  />

                  {/* Business Name */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Business Name</label>
                    <input 
                      type="text" 
                      value={businessName} 
                      onChange={(e) => setBusinessName(e.target.value)} 
                      className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-800 focus:outline-none focus:ring-1 focus:ring-rose-500 focus:border-rose-500 text-sm" 
                      placeholder="E.g., The Sapphire Room" 
                      required 
                    />
                  </div>

                  {/* Business Address */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Business Address</label>
                    <input 
                      type="text" 
                      value={address} 
                      onChange={(e) => setAddress(e.target.value)} 
                      className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-800 focus:outline-none focus:ring-1 focus:ring-rose-500 focus:border-rose-500 text-sm" 
                      placeholder="E.g., Downtown Italian" 
                      required 
                    />
                  </div>

                  {/* Phone Number */}
                  <PhoneInput
                    label="Phone Number"
                    labelClassName="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2"
                    variant="light"
                    value={phone}
                    onChange={setPhone}
                    onValidChange={setPhoneValid}
                    required
                    placeholder="9876543210"
                    helperText="9–12 digits, numbers only"
                  />

                  {/* Description */}
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Description</label>
                    <textarea 
                      value={description} 
                      onChange={(e) => setDescription(e.target.value)} 
                      className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-800 focus:outline-none focus:ring-1 focus:ring-rose-500 focus:border-rose-500 text-sm" 
                      placeholder="Brief description of your venue..." 
                      rows={2} 
                    />
                  </div>
                </div>

                <hr className="border-slate-200 my-2" />
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <h3 className="text-base font-bold text-slate-800">Admin Credentials</h3>
                  </div>
                  
                  {/* Admin Login Email */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Admin Login Email</label>
                    <input 
                      type="email" 
                      value={adminEmail} 
                      onChange={(e) => setAdminEmail(e.target.value)} 
                      className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-800 focus:outline-none focus:ring-1 focus:ring-rose-500 focus:border-rose-500 text-sm" 
                      placeholder="admin@sapphire.com" 
                      required 
                    />
                  </div>

                  {/* Password */}
                  <PasswordInput
                    label="Password"
                    labelClassName="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2"
                    variant="light"
                    mode="create"
                    value={adminPassword}
                    onChange={setAdminPassword}
                    onValidChange={setPasswordValid}
                    required
                    placeholder="Create a password..."
                  />
                </div>

                {onboardStatus === 'error' && (
                  <p className="text-sm font-semibold text-rose-500 text-center mt-2">Registration failed. Please check your credentials or try again.</p>
                )}

                <div className="mt-4 pt-4 border-t border-slate-150">
                  <button 
                    type="submit" 
                    disabled={
                      isOnboarding ||
                      !businessName ||
                      !adminEmail ||
                      !phoneValid ||
                      !passwordValid ||
                      !parentTypeId ||
                      (!isEventParent && !venueTypeId)
                    } 
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 transition-colors"
                  >
                    {isOnboarding ? (
                      <>
                        <Loader2 size={18} className="animate-spin" /> Registering...
                      </>
                    ) : (
                      <>
                        <Plus size={18} /> Register Business
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
