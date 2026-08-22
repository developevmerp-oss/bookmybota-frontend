"use client";
import { useState, useEffect } from 'react';
import { Save, ImagePlus, X, Upload, Info, Wifi, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useGetBusinessSettingsQuery, useUpdateBusinessSettingsMutation, useUploadImageMutation, useGetDiningCuisinesQuery, useGetCollectionsQuery, useGetCitiesQuery } from '@/services/api';
import { useAppDispatch, useAppSelector } from '@/lib/hooks';
import { loadFromStorage } from '@/features/auth/authSlice';
import { isValidPhone } from '@/lib/validation';
import PhoneInput from '@/components/Shared/PhoneInput';
import ImageCropPicker, { CroppedImageField } from '@/components/Shared/ImageCropPicker';

function normalizeImageList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed)
        ? parsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        : [];
    } catch {
      return [];
    }
  }
  return [];
}

export default function ProfilePage() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  useEffect(() => { dispatch(loadFromStorage()); }, [dispatch]);

  const bizId = user?.business_id ?? '';
  const { data: settings, isLoading } = useGetBusinessSettingsQuery(bizId, { skip: !bizId });
  const { data: cuisineMasters = [] } = useGetDiningCuisinesQuery();
  const { data: collections = [] } = useGetCollectionsQuery();
  const { data: cities = [] } = useGetCitiesQuery();
  const [updateSettings, { isLoading: saving }] = useUpdateBusinessSettingsMutation();

  const [phone, setPhone] = useState('');
  const [phoneValid, setPhoneValid] = useState(true);
  const [description, setDescription] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [menuImages, setMenuImages] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState("Basic Info");
  const [amenities, setAmenities] = useState<string[]>([]);
  const [averageCost, setAverageCost] = useState<string>('');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [cityId, setCityId] = useState<number | ''>('');
  const [cuisine, setCuisine] = useState('');
  const [collectionIds, setCollectionIds] = useState<number[]>([]);
  const [openTime, setOpenTime] = useState('08:00');
  const [closeTime, setCloseTime] = useState('23:30');
  const [uploadImage] = useUploadImageMutation();

  useEffect(() => {
    if (settings) {
      setPhone(settings.phone || '');
      setDescription(settings.description || '');
      setCoverUrl(settings.cover_image_url || '');
      setGalleryImages(normalizeImageList(settings.gallery_images));
      setMenuImages(normalizeImageList(settings.menu_images));
      setAmenities(settings.amenities || []);
      if (settings.average_cost) setAverageCost(settings.average_cost.toString());
      if (settings.name) setName(settings.name);
      if (settings.address) setAddress(settings.address);
      setCityId(settings.city_id ?? '');
      if (settings.cuisine) setCuisine(settings.cuisine);
      setCollectionIds(
        Array.isArray(settings.collection_ids)
          ? settings.collection_ids.map(Number).filter((n) => Number.isInteger(n) && n > 0)
          : []
      );

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
          amenities: amenities,
          average_cost: averageCost ? parseInt(averageCost) : undefined,
          name,
          address,
          city_id: cityId === '' ? null : cityId,
          cuisine,
          collection_ids: collectionIds,
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

  const uploadCropped = async (file: File, type: 'gallery' | 'menu' | 'cover') => {
    const formData = new FormData();
    formData.append('image', file);
    try {
      const res = await uploadImage(formData).unwrap();
      if (res.url) {
        if (type === 'gallery') setGalleryImages((prev) => [...prev, res.url]);
        else if (type === 'menu') setMenuImages((prev) => [...prev, res.url]);
        else setCoverUrl(res.url);
      }
    } catch {
      toast.error('Failed to upload ' + file.name);
    }
  };

  const selectedCuisines = cuisine
    .split(/[,·|]/)
    .map((s) => s.trim())
    .filter(Boolean);

  const toggleCuisine = (name: string) => {
    const exists = selectedCuisines.some((c) => c.toLowerCase() === name.toLowerCase());
    const next = exists
      ? selectedCuisines.filter((c) => c.toLowerCase() !== name.toLowerCase())
      : [...selectedCuisines, name];
    setCuisine(next.join(', '));
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
                <label className="block text-sm font-medium text-zinc-400 mb-2">City</label>
                <select
                  value={cityId === '' ? '' : String(cityId)}
                  onChange={(e) => setCityId(e.target.value ? Number(e.target.value) : '')}
                  className="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-all"
                >
                  <option value="">Select city</option>
                  {cities.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}{c.state ? `, ${c.state}` : ''}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-zinc-500 mt-1">Used for the top-bar city filter on the dining listing.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">Full Address</label>
                <textarea value={address} onChange={(e) => setAddress(e.target.value)} className="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-all" placeholder="Enter complete address..." rows={2} />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">Cuisines</label>
                {cuisineMasters.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {cuisineMasters.map((c) => {
                      const selected = selectedCuisines.some(
                        (name) => name.toLowerCase() === c.name.toLowerCase()
                      );
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => toggleCuisine(c.name)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                            selected
                              ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                              : 'text-zinc-400 border-white/10 hover:bg-white/5 hover:text-white'
                          }`}
                        >
                          {c.name}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <>
                    <input type="text" value={cuisine} onChange={(e) => setCuisine(e.target.value)} className="input-field" placeholder="e.g. Italian, Mexican" />
                    <p className="text-xs text-zinc-500 mt-1">Comma separated</p>
                  </>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">Collections</label>
                {collections.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {collections.map((c) => {
                      const selected = collectionIds.includes(c.id);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() =>
                            setCollectionIds((prev) =>
                              selected ? prev.filter((id) => id !== c.id) : [...prev, c.id]
                            )
                          }
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                            selected
                              ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                              : 'text-zinc-400 border-white/10 hover:bg-white/5 hover:text-white'
                          }`}
                        >
                          {c.title}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-zinc-500">No collections available yet. Super Admin can add them in Dining Masters.</p>
                )}
                <p className="text-xs text-zinc-500 mt-1">Choose the curated lists this venue should appear in on the dining homepage.</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                <CroppedImageField
                  value={coverUrl}
                  aspect={16 / 9}
                  previewClassName="mt-2 w-full h-48 rounded-xl border border-white/10"
                  emptyClassName="flex flex-col items-center justify-center w-full h-48 border-2 border-zinc-700 border-dashed rounded-xl bg-zinc-900/50 hover:bg-zinc-800/50 transition-colors"
                  onRemove={() => setCoverUrl('')}
                  onCroppedFile={(file) => uploadCropped(file, 'cover')}
                  emptyContent={
                    <>
                      <ImagePlus className="w-8 h-8 mb-3 text-zinc-400" />
                      <p className="mb-2 text-sm text-zinc-400"><span className="font-semibold text-rose-500">Click to add</span> a cover image</p>
                      <p className="text-xs text-zinc-500">Drag a box to crop, then save</p>
                    </>
                  }
                />
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
                <ImageCropPicker
                  aspect={4 / 3}
                  className="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-4 py-3 text-zinc-300 text-sm text-left"
                  onCroppedFile={(file) => uploadCropped(file, 'gallery')}
                >
                  Crop & add gallery photo
                </ImageCropPicker>
                <p className="text-xs text-zinc-500 mt-2 mb-4">These images will appear in the photo grid on your restaurant's booking page.</p>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
                  {galleryImages.map((url, idx) => (
                    <CroppedImageField
                      key={`${url}-${idx}`}
                      value={url}
                      aspect={4 / 3}
                      previewClassName="h-24 rounded-xl w-full border border-white/10"
                      onRemove={() => removeImage(idx, 'gallery')}
                      onCroppedFile={async (file) => {
                        const formData = new FormData();
                        formData.append('image', file);
                        try {
                          const res = await uploadImage(formData).unwrap();
                          if (res.url) {
                            setGalleryImages((prev) => prev.map((u, i) => (i === idx ? res.url : u)));
                          }
                        } catch {
                          toast.error('Failed to upload ' + file.name);
                        }
                      }}
                    />
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-white/5">
                <label className="block text-sm font-medium text-zinc-400 mb-2">Upload Menu Images</label>
                <ImageCropPicker
                  aspect={3 / 4}
                  className="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-4 py-3 text-zinc-300 text-sm text-left"
                  onCroppedFile={(file) => uploadCropped(file, 'menu')}
                >
                  Crop & add menu photo
                </ImageCropPicker>
                <p className="text-xs text-zinc-500 mt-2 mb-4">Upload images of your food and beverage menus.</p>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
                  {menuImages.map((url, idx) => (
                    <CroppedImageField
                      key={`${url}-${idx}`}
                      value={url}
                      aspect={3 / 4}
                      previewClassName="h-32 rounded-xl w-full border border-white/10"
                      onRemove={() => removeImage(idx, 'menu')}
                      onCroppedFile={async (file) => {
                        const formData = new FormData();
                        formData.append('image', file);
                        try {
                          const res = await uploadImage(formData).unwrap();
                          if (res.url) {
                            setMenuImages((prev) => prev.map((u, i) => (i === idx ? res.url : u)));
                          }
                        } catch {
                          toast.error('Failed to upload ' + file.name);
                        }
                      }}
                    />
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
