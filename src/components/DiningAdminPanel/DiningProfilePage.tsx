"use client";
import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import {
  Save,
  ImagePlus,
  Wifi,
  Image as ImageIcon,
  Info,
  Lock,
  Store,
  Armchair,
  Trees,
  Snowflake,
  Car,
  CreditCard,
  Wine,
  Leaf,
  Music,
  PawPrint,
  CalendarCheck,
  Accessibility,
  type LucideIcon,
} from 'lucide-react';
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
import ChangePasswordForm from '@/components/Shared/ChangePasswordForm';

const fieldErrorClass = 'mt-1.5 text-[11px] font-semibold text-rose-500';
const labelClass = 'block text-sm font-medium text-slate-600 mb-2';
const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-500/20 transition-all';
const helperClass = 'text-xs text-slate-500 mt-1';
const panelClass =
  'bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 animate-in fade-in slide-in-from-bottom-2 duration-300';
const chipSelected =
  'bg-sky-50 text-sky-700 border-sky-200';
const chipIdle =
  'text-slate-500 border-slate-200 hover:bg-slate-50 hover:text-slate-700';

const TABS = [
  { name: 'Basic Info', icon: Info },
  { name: 'Facilities', icon: Wifi },
  { name: 'Photos & Menu', icon: ImageIcon },
  { name: 'Change Password', icon: Lock },
] as const;

const VENUE_AMENITIES: {
  label: string;
  icon: LucideIcon;
  iconClass: string;
  iconBg: string;
}[] = [
  { label: 'Indoor seating', icon: Armchair, iconClass: 'text-sky-600', iconBg: 'bg-sky-50' },
  { label: 'Outdoor seating', icon: Trees, iconClass: 'text-emerald-600', iconBg: 'bg-emerald-50' },
  { label: 'Air Conditioned', icon: Snowflake, iconClass: 'text-violet-600', iconBg: 'bg-violet-50' },
  { label: 'Free WiFi', icon: Wifi, iconClass: 'text-amber-700', iconBg: 'bg-amber-50' },
  { label: 'Valet parking available', icon: Car, iconClass: 'text-slate-600', iconBg: 'bg-slate-100' },
  { label: 'Card accepted', icon: CreditCard, iconClass: 'text-rose-600', iconBg: 'bg-rose-50' },
  { label: 'Full Bar available', icon: Wine, iconClass: 'text-indigo-600', iconBg: 'bg-indigo-50' },
  { label: 'Vegetarian friendly', icon: Leaf, iconClass: 'text-lime-700', iconBg: 'bg-lime-50' },
  { label: 'Live Music', icon: Music, iconClass: 'text-fuchsia-600', iconBg: 'bg-fuchsia-50' },
  { label: 'Pet friendly', icon: PawPrint, iconClass: 'text-orange-600', iconBg: 'bg-orange-50' },
  { label: 'Table Booking Recommended', icon: CalendarCheck, iconClass: 'text-teal-600', iconBg: 'bg-teal-50' },
  { label: 'Wheelchair Accessible', icon: Accessibility, iconClass: 'text-green-600', iconBg: 'bg-green-50' },
];

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

  if (isLoading || !user) return <div className="text-slate-500 p-10 text-center">Loading Profile...</div>;

  const isPasswordTab = activeTab === 'Change Password';

  return (
    <div className="-m-4 sm:-m-8 min-h-[calc(100vh-5rem)] bg-white p-4 sm:p-8 animate-fadeIn">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">Profile</h1>
          {!isPasswordTab && (
            <button
              type="button"
              onClick={() => void onSave()}
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl bg-[#e11d48] text-white-keep text-sm font-semibold hover:bg-[#be123c] disabled:opacity-60 cursor-pointer shrink-0"
            >
              <Save size={18} /> {saving ? 'Saving...' : 'Save Profile'}
            </button>
          )}
        </div>

        <div className="flex flex-col lg:flex-row gap-4 sm:gap-6 items-start">
          <aside className="w-full lg:w-[240px] shrink-0 lg:sticky lg:top-24 self-start">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3">
              <h2 className="px-3 pt-2 pb-3 text-xl sm:text-2xl border-b border-slate-200 mb-3 font-extrabold text-slate-900">
                My Account
              </h2>
              <nav className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible">
                {TABS.map((tab) => {
                  const active = activeTab === tab.name;
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.name}
                      type="button"
                      onClick={() => setActiveTab(tab.name)}
                      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors cursor-pointer ${
                        active
                          ? 'bg-rose-50 text-[#e11d48] border border-rose-100'
                          : 'text-slate-500 border border-transparent hover:bg-slate-50 hover:text-slate-700'
                      }`}
                    >
                      <Icon size={18} />
                      <span>{tab.name}</span>
                    </button>
                  );
                })}
              </nav>
            </div>
          </aside>

          <div className="flex-1 min-w-0 w-full space-y-6">
            {activeTab === "Basic Info" && (
              <div className={panelClass}>
                <h3 className="text-lg font-bold text-slate-900 mb-6">Public Information</h3>
                <form
                  id="dining-partner-profile-form"
                  onSubmit={onSave}
                  className="space-y-4"
                  noValidate
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>
                        Venue Name <RequiredMark />
                      </label>
                      <input
                        type="text"
                        className={inputClass}
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
                          labelClassName={labelClass}
                          variant="light"
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
                    <label className={labelClass}>City</label>
                    <select className={inputClass} {...register('city_id')}>
                      <option value="">Select city</option>
                      {cities.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}{c.state ? `, ${c.state}` : ''}
                        </option>
                      ))}
                    </select>
                    <p className={helperClass}>Used for the top-bar city filter on the dining listing.</p>
                    {errors.city_id && <p className={fieldErrorClass}>{errors.city_id.message}</p>}
                  </div>

                  <div>
                    <label className={labelClass}>
                      Full Address <RequiredMark />
                    </label>
                    <textarea
                      className={inputClass}
                      placeholder="Enter complete address..."
                      rows={2}
                      {...register('address')}
                    />
                    {errors.address && <p className={fieldErrorClass}>{errors.address.message}</p>}
                  </div>

                  <div>
                    <label className={labelClass}>Cuisines</label>
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
                                selected ? chipSelected : chipIdle
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
                          className={inputClass}
                          placeholder="e.g. Italian, Mexican"
                        />
                        <p className={helperClass}>Comma separated</p>
                      </>
                    )}
                  </div>
                  <div>
                    <label className={labelClass}>Collections</label>
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
                                selected ? chipSelected : chipIdle
                              }`}
                            >
                              {c.title}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500">No collections available yet. Super Admin can add them in Dining Masters.</p>
                    )}
                    <p className={helperClass}>Choose the curated lists this venue should appear in on the dining homepage.</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>Open Time</label>
                      <input type="time" className={inputClass} {...register('open_time')} />
                      {errors.open_time && <p className={fieldErrorClass}>{errors.open_time.message}</p>}
                    </div>
                    <div>
                      <label className={labelClass}>Close Time</label>
                      <input type="time" className={inputClass} {...register('close_time')} />
                      {errors.close_time && <p className={fieldErrorClass}>{errors.close_time.message}</p>}
                    </div>
                  </div>

                  <div>
                    <label className={labelClass}>Cover Image</label>
                    <CroppedImageField
                      value={coverUrl}
                      aspect={16 / 9}
                      previewClassName="mt-2 w-full aspect-[16/9] rounded-xl border border-slate-200 overflow-hidden"
                      emptyClassName="flex flex-col items-center justify-center w-full aspect-[16/9] border-2 border-slate-200 border-dashed rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors"
                      onRemove={() => setCoverUrl('')}
                      onCroppedFile={(file) => uploadCropped(file, 'cover')}
                      emptyContent={
                        <>
                          <ImagePlus className="w-8 h-8 mb-3 text-slate-400" />
                          <p className="mb-2 text-sm text-slate-500"><span className="font-semibold text-sky-600">Click to add</span> a cover image</p>
                          <p className="text-xs text-slate-500">Drag a box to crop, then save</p>
                        </>
                      }
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Average Cost for Two (ETB)</label>
                    <input
                      type="number"
                      className={inputClass}
                      placeholder="e.g. 1200"
                      {...register('average_cost')}
                    />
                    <p className={helperClass}>Leave blank to use default price range mapping.</p>
                    {errors.average_cost && (
                      <p className={fieldErrorClass}>{errors.average_cost.message}</p>
                    )}
                  </div>
                  <div>
                    <label className={labelClass}>About the Venue</label>
                    <textarea
                      className={inputClass}
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
              <div className={panelClass}>
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 h-10 w-10 shrink-0 rounded-xl bg-rose-50 text-[#e11d48] flex items-center justify-center">
                      <Store size={20} />
                    </span>
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">Venue Amenities</h3>
                      <p className="text-xs text-slate-500 mt-1">
                        Select the amenities and features available at your venue.
                      </p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1.5 self-start rounded-full bg-slate-100 px-3 py-1.5 text-[11px] font-medium text-slate-500">
                    <Info size={12} />
                    These details will be shown to customers.
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
                  {VENUE_AMENITIES.map((amenity) => {
                    const selected = amenities.includes(amenity.label);
                    const Icon = amenity.icon;
                    return (
                      <label
                        key={amenity.label}
                        className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3 cursor-pointer transition-colors hover:bg-slate-50"
                      >
                        <span
                          className={`h-9 w-9 shrink-0 rounded-full flex items-center justify-center ${amenity.iconBg} ${amenity.iconClass}`}
                        >
                          <Icon size={16} />
                        </span>
                        <span className="flex-1 min-w-0 text-sm font-medium text-slate-800 truncate">
                          {amenity.label}
                        </span>
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setAmenities([...amenities, amenity.label]);
                            } else {
                              setAmenities(amenities.filter((a) => a !== amenity.label));
                            }
                          }}
                          className="h-4 w-4 shrink-0 rounded border-slate-300 bg-white accent-[#e11d48] text-[#e11d48] focus:ring-[#e11d48] focus:ring-offset-0"
                        />
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {activeTab === "Photos & Menu" && (
              <div className={panelClass}>
                <h3 className="text-lg font-bold text-slate-900 mb-6">Media Gallery</h3>
                <div className="space-y-6">
                  <div>
                    <label className={labelClass}>Upload Photo Gallery Images</label>
                    <ImageCropPicker
                      aspect={4 / 3}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-600 text-sm text-left hover:bg-slate-50 transition-colors"
                      onCroppedFile={(file) => uploadCropped(file, 'gallery')}
                    >
                      Crop & add gallery photo
                    </ImageCropPicker>
                    <p className="text-xs text-slate-500 mt-2 mb-4">These images will appear in the photo grid on your restaurant&apos;s booking page.</p>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
                      {galleryImages.map((url, idx) => (
                        <CroppedImageField
                          key={`${url}-${idx}`}
                          value={url}
                          aspect={4 / 3}
                          previewClassName="aspect-[4/3] rounded-xl w-full border border-slate-200 overflow-hidden"
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

                  <div className="pt-4 border-t border-slate-200">
                    <label className={labelClass}>Upload Menu Images</label>
                    <ImageCropPicker
                      aspect={3 / 4}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-600 text-sm text-left hover:bg-slate-50 transition-colors"
                      onCroppedFile={(file) => uploadCropped(file, 'menu')}
                    >
                      Crop & add menu photo
                    </ImageCropPicker>
                    <p className="text-xs text-slate-500 mt-2 mb-4">Upload images of your food and beverage menus.</p>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
                      {menuImages.map((url, idx) => (
                        <CroppedImageField
                          key={`${url}-${idx}`}
                          value={url}
                          aspect={3 / 4}
                          previewClassName="aspect-[3/4] rounded-xl w-full border border-slate-200 overflow-hidden max-w-[160px]"
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

            {isPasswordTab && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-6 max-w-lg">
                <ChangePasswordForm variant="light" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
