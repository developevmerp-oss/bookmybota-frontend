"use client";
import { useState, useEffect } from 'react';
import { Save, ImagePlus, X, Upload, Info, Tag, Wifi, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useGetBusinessSettingsQuery, useUpdateBusinessSettingsMutation, useUploadImageMutation } from '@/services/api';
import { useAppDispatch, useAppSelector } from '@/lib/hooks';
import { loadFromStorage } from '@/features/auth/authSlice';
import PhoneInput from '@/components/Shared/PhoneInput';
import { isValidPhone } from '@/lib/validation';

export default function ProfilePage() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  useEffect(() => { dispatch(loadFromStorage()); }, [dispatch]);

  const bizId = user?.business_id ?? '';
  const { data: settings, isLoading } = useGetBusinessSettingsQuery(bizId, { skip: !bizId });
  const [updateSettings, { isLoading: saving }] = useUpdateBusinessSettingsMutation();

  const [phone, setPhone] = useState('');
  const [phoneValid, setPhoneValid] = useState(true);
  const [description, setDescription] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [menuImages, setMenuImages] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState("Basic Info");
  const [diningOffers, setDiningOffers] = useState<{ type: string; title: string; validity: string }[]>([]);
  const [amenities, setAmenities] = useState<string[]>([]);
  const [averageCost, setAverageCost] = useState<string>('');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [cuisine, setCuisine] = useState('');
  const [openTime, setOpenTime] = useState('08:00');
  const [closeTime, setCloseTime] = useState('23:30');
  const [uploadImage] = useUploadImageMutation();

  useEffect(() => {
    if (settings) {
      setPhone(settings.phone || '');
      setDescription(settings.description || '');
      setCoverUrl(settings.cover_image_url || '');
      setGalleryImages(settings.gallery_images || []);
      setMenuImages(settings.menu_images || []);
      setDiningOffers(settings.dining_offers || []);
      setAmenities(settings.amenities || []);
      if (settings.average_cost) setAverageCost(settings.average_cost.toString());
      if (settings.name) setName(settings.name);
      if (settings.address) setAddress(settings.address);
      if (settings.cuisine) setCuisine(settings.cuisine);

      if (settings.operating_hours && settings.operating_hours['monday']) {
        setOpenTime(settings.operating_hours['monday'].open || '08:00');
        setCloseTime(settings.operating_hours['monday'].close || '23:30');
      }
    }
  }, [settings]);

  const handleSave = async () => {
    if (!bizId) return;
    if (phone.trim() && !isValidPhone(phone)) {
      toast.error('Phone must be 9–12 digits (numbers only)');
      return;
    }
    try {
      await updateSettings({
        bizId,
        body: {
          phone,
          description,
          cover_image_url: coverUrl,
          gallery_images: galleryImages,
          menu_images: menuImages,
          dining_offers: diningOffers,
          amenities: amenities,
          average_cost: averageCost ? parseInt(averageCost) : undefined,
          name,
          address,
          cuisine,
          operating_hours: {
            sunday: { open: openTime, close: closeTime, closed: false },
            monday: { open: openTime, close: closeTime, closed: false },
            tuesday: { open: openTime, close: closeTime, closed: false },
            wednesday: { open: openTime, close: closeTime, closed: false },
            thursday: { open: openTime, close: closeTime, closed: false },
            friday: { open: openTime, close: closeTime, closed: false },
            saturday: { open: openTime, close: closeTime, closed: false },
          }
        }
      }).unwrap();
      toast.success('Profile saved successfully!');
    } catch (err) {
      console.error(err);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'gallery' | 'menu' | 'cover') => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);

    for (const file of files) {
      const formData = new FormData();
      formData.append('image', file);

      try {
        const res = await uploadImage(formData).unwrap();
        if (res.url) {
          if (type === 'gallery') {
            setGalleryImages(prev => [...prev, res.url]);
          } else if (type === 'menu') {
            setMenuImages(prev => [...prev, res.url]);
          } else if (type === 'cover') {
            setCoverUrl(res.url);
          }
        }
      } catch (err) {
        console.error('Upload failed:', err);
        toast.error('Failed to upload ' + file.name);
      }
    }
  };

  const removeImage = (index: number, type: 'gallery' | 'menu') => {
    if (type === 'gallery') {
      setGalleryImages(prev => prev.filter((_, i) => i !== index));
    } else {
      setMenuImages(prev => prev.filter((_, i) => i !== index));
    }
  };

  if (isLoading || !user) return <div className="text-white p-10 text-center">Loading Profile...</div>;

  return (
    <div className="max-w-7xl mx-auto animate-fadeIn">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-white/10 mb-6 gap-4 sm:gap-0">
        <div className="flex overflow-x-auto hide-scrollbar w-full sm:w-auto">
        {[
          { name: "Basic Info", icon: <Info size={16} /> },
          { name: "Facilities", icon: <Wifi size={16} /> },
          { name: "Photos & Menu", icon: <ImageIcon size={16} /> },
          { name: "Offers", icon: <Tag size={16} /> }
        ].map((tab) => (
          <button
            key={tab.name}
            onClick={() => setActiveTab(tab.name)}
            className={`flex items-center gap-2 px-6 py-4 text-sm font-bold border-b-2 transition-all whitespace-nowrap ${activeTab === tab.name
                ? "border-rose-500 text-rose-500"
                : "border-transparent text-zinc-500 hover:text-white"
              }`}
          >
            {tab.icon}
            {tab.name}
          </button>
        ))}
        </div>
        <button onClick={handleSave} disabled={saving || (phone.trim() !== '' && !phoneValid)} className="btn-primary flex items-center gap-2 shrink-0 mb-2 sm:mb-0">
          <Save size={18} /> {saving ? 'Saving...' : 'Save Profile'}
        </button>
      </div>

      <div className="space-y-6">
        {activeTab === "Basic Info" && (
          <div className="glass-panel p-8 rounded-2xl border border-white/5 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <h3 className="text-lg font-bold text-white mb-6">Public Information</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">Venue Name</label>
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="input-field" placeholder="e.g. The Grand Place" />
                </div>
                <PhoneInput
                  label="Public Phone Number"
                  labelClassName="block text-sm font-medium text-zinc-400 mb-2"
                  variant="dark"
                  value={phone}
                  onChange={setPhone}
                  onValidChange={setPhoneValid}
                  required={false}
                  placeholder="9876543210"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">Full Address</label>
                <textarea value={address} onChange={(e) => setAddress(e.target.value)} className="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-all" placeholder="Enter complete address..." rows={2} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">Cuisines</label>
                  <input type="text" value={cuisine} onChange={(e) => setCuisine(e.target.value)} className="input-field" placeholder="e.g. Italian, Mexican" />
                  <p className="text-xs text-zinc-500 mt-1">Comma separated</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">Open Time</label>
                  <input type="time" value={openTime} onChange={(e) => setOpenTime(e.target.value)} className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">Close Time</label>
                  <input type="time" value={closeTime} onChange={(e) => setCloseTime(e.target.value)} className="input-field" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">Cover Image</label>
                {coverUrl ? (
                  <div className="relative mt-2 w-full h-48 rounded-xl overflow-hidden border border-white/10 group">
                    <img src={coverUrl} alt="Cover Preview" className="w-full h-full object-cover" />
                    <button
                      onClick={() => setCoverUrl('')}
                      className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Remove Cover Image"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <div className="mt-2 flex items-center justify-center w-full">
                    <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-zinc-700 border-dashed rounded-xl cursor-pointer bg-zinc-900/50 hover:bg-zinc-800/50 transition-colors">
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <ImagePlus className="w-8 h-8 mb-3 text-zinc-400" />
                        <p className="mb-2 text-sm text-zinc-400"><span className="font-semibold text-rose-500">Click to upload</span> a cover image</p>
                        <p className="text-xs text-zinc-500">PNG, JPG up to 10MB</p>
                      </div>
                      <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'cover')} />
                    </label>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">Average Cost for Two (ETB)</label>
                <input
                  type="number"
                  value={averageCost}
                  onChange={(e) => setAverageCost(e.target.value)}
                  className="input-field"
                  placeholder="e.g. 1200"
                />
                <p className="text-xs text-zinc-500 mt-1">Leave blank to use default price range mapping.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">About the Venue</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-all" placeholder="Tell your story. What makes your venue special?" rows={5} />
              </div>
            </div>
          </div>
        )}

        {activeTab === "Offers" && (
          <div className="glass-panel p-8 rounded-2xl border border-white/5 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-white">Dining Offers & Promotions</h3>
              <button
                onClick={() => setDiningOffers([...diningOffers, { type: 'Pre-Book Offer', title: '', validity: '' }])}
                className="text-xs font-bold bg-rose-600/20 text-rose-500 hover:bg-rose-600 hover:text-white px-3 py-1.5 rounded-lg transition-colors"
              >
                + Add Offer
              </button>
            </div>

            <div className="space-y-4">
              {diningOffers.length === 0 ? (
                <p className="text-sm text-zinc-500 italic">No dining offers configured. Click "+ Add Offer" to create one.</p>
              ) : (
                diningOffers.map((offer, idx) => (
                  <div key={idx} className="relative bg-zinc-900/50 border border-white/10 rounded-xl p-4">
                    <button
                      onClick={() => setDiningOffers(diningOffers.filter((_, i) => i !== idx))}
                      className="absolute top-3 right-3 text-zinc-500 hover:text-rose-500 transition-colors"
                      title="Remove Offer"
                    >
                      <X size={16} />
                    </button>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pr-6">
                      <div>
                        <label className="block text-xs font-medium text-zinc-400 mb-1">Offer Type</label>
                        <input
                          type="text"
                          value={offer.type}
                          onChange={(e) => {
                            const newOffers = [...diningOffers];
                            newOffers[idx].type = e.target.value;
                            setDiningOffers(newOffers);
                          }}
                          className="input-field text-sm"
                          placeholder="e.g. Pre-Book Offer"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-zinc-400 mb-1">Offer Title</label>
                        <input
                          type="text"
                          value={offer.title}
                          onChange={(e) => {
                            const newOffers = [...diningOffers];
                            newOffers[idx].title = e.target.value;
                            setDiningOffers(newOffers);
                          }}
                          className="input-field text-sm"
                          placeholder="e.g. Flat 10% OFF"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-zinc-400 mb-1">Validity text</label>
                        <input
                          type="text"
                          value={offer.validity}
                          onChange={(e) => {
                            const newOffers = [...diningOffers];
                            newOffers[idx].validity = e.target.value;
                            setDiningOffers(newOffers);
                          }}
                          className="input-field text-sm"
                          placeholder="e.g. Valid 11AM - 11PM"
                        />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === "Facilities" && (
          <div className="glass-panel p-8 rounded-2xl border border-white/5 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <h3 className="text-lg font-bold text-white mb-6">Venue Amenities</h3>
            <p className="text-xs text-zinc-500 mb-4">Select the amenities and features available at your venue.</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {[
                "Indoor seating", "Outdoor seating", "Air Conditioned",
                "Free WiFi", "Valet parking available", "Card accepted",
                "Full Bar available", "Vegetarian friendly", "Live Music",
                "Pet friendly", "Table Booking Recommended", "Wheelchair Accessible"
              ].map((amenity) => (
                <label key={amenity} className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={amenities.includes(amenity)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setAmenities([...amenities, amenity]);
                      } else {
                        setAmenities(amenities.filter(a => a !== amenity));
                      }
                    }}
                    className="rounded border-white/20 bg-zinc-900/50 text-rose-600 focus:ring-rose-500"
                  />
                  <span className="truncate">{amenity}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {activeTab === "Photos & Menu" && (
          <div className="glass-panel p-8 rounded-2xl border border-white/5 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <h3 className="text-lg font-bold text-white mb-6">Media Gallery</h3>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">Upload Photo Gallery Images</label>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={(e) => handleFileUpload(e, 'gallery')}
                  className="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-4 py-3 text-zinc-300 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-all text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-rose-50 file:text-rose-700 hover:file:bg-rose-100"
                />
                <p className="text-xs text-zinc-500 mt-2 mb-4">These images will appear in the photo grid on your restaurant's booking page.</p>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
                  {galleryImages.map((url, idx) => (
                    <div key={idx} className="relative group rounded-xl overflow-hidden h-24 border border-white/10">
                      <img src={url} alt={`Gallery ${idx}`} className="w-full h-full object-cover" />
                      <button
                        onClick={() => removeImage(idx, 'gallery')}
                        className="absolute top-1 right-1 bg-black/60 hover:bg-rose-600 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        &times;
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-white/5">
                <label className="block text-sm font-medium text-zinc-400 mb-2">Upload Menu Images</label>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={(e) => handleFileUpload(e, 'menu')}
                  className="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-4 py-3 text-zinc-300 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-all text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-rose-50 file:text-rose-700 hover:file:bg-rose-100"
                />
                <p className="text-xs text-zinc-500 mt-2 mb-4">Upload images of your food and beverage menus.</p>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
                  {menuImages.map((url, idx) => (
                    <div key={idx} className="relative group rounded-xl overflow-hidden h-32 border border-white/10">
                      <img src={url} alt={`Menu ${idx}`} className="w-full h-full object-cover" />
                      <button
                        onClick={() => removeImage(idx, 'menu')}
                        className="absolute top-1 right-1 bg-black/60 hover:bg-rose-600 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        &times;
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
