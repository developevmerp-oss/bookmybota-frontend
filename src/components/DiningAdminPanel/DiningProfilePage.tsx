"use client";
import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import { Save, ImagePlus, Wifi, Image as ImageIcon, Info } from 'lucide-react';
import { toast } from 'sonner';
import { useGetBusinessSettingsQuery, useUpdateBusinessSettingsMutation, useUploadImageMutation, useGetDiningCuisinesQuery, useGetCollectionsQuery, useGetCitiesQuery } from '@/services/api';
import { useAppDispatch, useAppSelector } from '@/lib/hooks';
import { loadFromStorage } from '@/features/auth/authSlice';
import { extractApiError } from '@/lib/apiErrors';
import {
  diningPartnerProfileSchema,
  emptyDiningPartnerProfileValues,
  type DiningPartnerProfileValues,
} from '@/lib/diningPartnerFormSchemas';
import PhoneInput from '@/components/Shared/PhoneInput';
import ImageCropPicker, { CroppedImageField } from '@/components/Shared/ImageCropPicker';

const fieldErrorClass = 'mt-1.5 text-[11px] font-semibold text-rose-500';

function RequiredMark() {
  return <span className="text-rose-500">*</span>;
}

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

  const [coverUrl, setCoverUrl] = useState('');
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [menuImages, setMenuImages] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState("Basic Info");
  const [amenities, setAmenities] = useState<string[]>([]);
  const [cuisine, setCuisine] = useState('');
  const [collectionIds, setCollectionIds] = useState<number[]>([]);
  const [uploadImage] = useUploadImageMutation();

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<DiningPartnerProfileValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: yupResolver(diningPartnerProfileSchema) as any,
    defaultValues: emptyDiningPartnerProfileValues(),
    mode: 'onSubmit',
  });

  useEffect(() => {
    if (settings) {
      reset({
        name: settings.name || '',
        phone: settings.phone || '',
        address: settings.address || '',
        city_id: settings.city_id != null ? String(settings.city_id) : '',
        description: settings.description || '',
        average_cost: settings.average_cost ? String(settings.average_cost) : '',
        open_time: settings.operating_hours?.['monday']?.open || '08:00',
        close_time: settings.operating_hours?.['monday']?.close || '23:30',
      });
      setCoverUrl(settings.cover_image_url || '');
      setGalleryImages(normalizeImageList(settings.gallery_images));
      setMenuImages(normalizeImageList(settings.menu_images));
      setAmenities(settings.amenities || []);
      if (settings.cuisine) setCuisine(settings.cuisine);
      setCollectionIds(
        Array.isArray(settings.collection_ids)
          ? settings.collection_ids.map(Number).filter((n) => Number.isInteger(n) && n > 0)
          : []
      );
    }
  }, [settings, reset]);

  const onSave = handleSubmit(
    async (values) => {
    if (!bizId) return;
    const openTime = values.open_time || '08:00';
    const closeTime = values.close_time || '23:30';
    try {
      const res = await updateSettings({
        bizId,
        body: {
          phone: values.phone,
          description: values.description,
          cover_image_url: coverUrl,
          gallery_images: galleryImages,
          menu_images: menuImages,
          amenities: amenities,
          average_cost: values.average_cost ? parseInt(values.average_cost, 10) : undefined,
          name: values.name.trim(),
          address: values.address.trim(),
          city_id: values.city_id ? Number(values.city_id) : null,
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
      toast.success((res as { message?: string }).message || 'Profile saved successfully!');
    } catch (err) {
      toast.error(extractApiError(err, 'Failed to save profile'));
    }
  },
    () => setActiveTab('Basic Info')
  );

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
    } catch (err) {
      toast.error(extractApiError(err, 'Failed to upload ' + file.name));
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
            type="button"
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
        <button
          type="button"
          onClick={() => void onSave()}
          disabled={saving}
          className="btn-primary flex items-center gap-2 shrink-0 mb-2 sm:mb-0 disabled:opacity-60"
        >
          <Save size={18} /> {saving ? 'Saving...' : 'Save Profile'}
        </button>
      </div>

      <div className="space-y-6">
        {activeTab === "Basic Info" && (
          <div className="glass-panel p-8 rounded-2xl border border-white/5 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <h3 className="text-lg font-bold text-white mb-6">Public Information</h3>
            <form
              id="dining-partner-profile-form"
              onSubmit={onSave}
              className="space-y-4"
              noValidate
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">
                    Venue Name <RequiredMark />
                  </label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="e.g. The Grand Place"
                    {...register('name')}
                  />
                  {errors.name && <p className={fieldErrorClass}>{errors.name.message}</p>}
                </div>
                <Controller
                  name="phone"
                  control={control}
                  render={({ field }) => (
                    <PhoneInput
                      label="Public Phone Number"
                      labelClassName="block text-sm font-medium text-zinc-400 mb-2"
                      variant="dark"
                      value={field.value || ''}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      required
                      placeholder="9876543210"
                      error={errors.phone?.message}
                    />
                  )}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">City</label>
                <select className="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-all" {...register('city_id')}>
                  <option value="">Select city</option>
                  {cities.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}{c.state ? `, ${c.state}` : ''}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-zinc-500 mt-1">Used for the top-bar city filter on the dining listing.</p>
                {errors.city_id && <p className={fieldErrorClass}>{errors.city_id.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">
                  Full Address <RequiredMark />
                </label>
                <textarea
                  className="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-all"
                  placeholder="Enter complete address..."
                  rows={2}
                  {...register('address')}
                />
                {errors.address && <p className={fieldErrorClass}>{errors.address.message}</p>}
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
                    <input
                      type="text"
                      value={cuisine}
                      onChange={(e) => setCuisine(e.target.value)}
                      className="input-field"
                      placeholder="e.g. Italian, Mexican"
                    />
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
                  <input type="time" className="input-field" {...register('open_time')} />
                  {errors.open_time && <p className={fieldErrorClass}>{errors.open_time.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">Close Time</label>
                  <input type="time" className="input-field" {...register('close_time')} />
                  {errors.close_time && <p className={fieldErrorClass}>{errors.close_time.message}</p>}
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
                  className="input-field"
                  placeholder="e.g. 1200"
                  {...register('average_cost')}
                />
                <p className="text-xs text-zinc-500 mt-1">Leave blank to use default price range mapping.</p>
                {errors.average_cost && (
                  <p className={fieldErrorClass}>{errors.average_cost.message}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">About the Venue</label>
                <textarea
                  className="w-full bg-zinc-900/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-all"
                  placeholder="Tell your story. What makes your venue special?"
                  rows={5}
                  {...register('description')}
                />
                {errors.description && (
                  <p className={fieldErrorClass}>{errors.description.message}</p>
                )}
              </div>
            </form>
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
                <p className="text-xs text-zinc-500 mt-2 mb-4">These images will appear in the photo grid on your restaurant&apos;s booking page.</p>

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
                        } catch (err) {
                          toast.error(extractApiError(err, 'Failed to upload ' + file.name));
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
                        } catch (err) {
                          toast.error(extractApiError(err, 'Failed to upload ' + file.name));
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
