'use client';

import { useEffect, useMemo, useState } from 'react';

export interface ObituaryDraft {
  name?: string | null;
  content?: string | null;
  imageUrl?: string | null;
  publishedAt?: string | null;
  firstName?: string | null;
  middleName?: string | null;
  surname?: string | null;
  otherNames?: string | null;
  dateOfBirth?: string | null;
  dateOfDeath?: string | null;
  placeOfBirth?: string | null;
  lastResidentialAddress?: string | null;
  fatherName?: string | null;
  motherName?: string | null;
  maritalStatus?: string | null;
  spouseName?: string | null;
  brothersNames?: string | null;
  sistersNames?: string | null;
  fatherInLawName?: string | null;
  motherInLawName?: string | null;
  sonsNames?: string | null;
  daughtersNames?: string | null;
  sonsInLawNames?: string | null;
  daughtersInLawNames?: string | null;
  grandchildrenNames?: string | null;
  occupations?: string | null;
  hobbiesInterests?: string | null;
  communityActivities?: string | null;
  otherDetails?: string | null;
  lifeStory?: string | null;
}

type DetailKey = Exclude<keyof ObituaryDraft, 'name' | 'content' | 'imageUrl' | 'publishedAt'>;

const sections: Array<{ title: string; fields: Array<{ key: DetailKey; label: string; multiline?: boolean }> }> = [
  {
    title: 'Personal Information',
    fields: [
      { key: 'firstName', label: 'First name' },
      { key: 'middleName', label: 'Middle name' },
      { key: 'surname', label: 'Last name / surname' },
      { key: 'otherNames', label: 'Other names' },
      { key: 'dateOfBirth', label: 'Date of birth' },
      { key: 'dateOfDeath', label: 'Date of death' },
      { key: 'placeOfBirth', label: 'Place of birth' },
      { key: 'lastResidentialAddress', label: 'Last residential address', multiline: true },
    ],
  },
  {
    title: 'Family Details',
    fields: [
      { key: 'fatherName', label: 'Father’s name' },
      { key: 'motherName', label: 'Mother’s name' },
      { key: 'maritalStatus', label: 'Marital status' },
      { key: 'spouseName', label: 'Spouse’s name' },
      { key: 'brothersNames', label: 'Brothers’ names', multiline: true },
      { key: 'sistersNames', label: 'Sisters’ names', multiline: true },
      { key: 'fatherInLawName', label: 'Father-in-law’s name' },
      { key: 'motherInLawName', label: 'Mother-in-law’s name' },
      { key: 'sonsNames', label: 'Sons’ names', multiline: true },
      { key: 'daughtersNames', label: 'Daughters’ names', multiline: true },
      { key: 'sonsInLawNames', label: 'Sons-in-law’s names', multiline: true },
      { key: 'daughtersInLawNames', label: 'Daughters-in-law’s names', multiline: true },
      { key: 'grandchildrenNames', label: 'Grandchildren’s names', multiline: true },
    ],
  },
  {
    title: 'Life and Community',
    fields: [
      { key: 'occupations', label: 'Occupation(s)', multiline: true },
      { key: 'hobbiesInterests', label: 'Hobbies and interests', multiline: true },
      { key: 'communityActivities', label: 'Community activities', multiline: true },
      { key: 'otherDetails', label: 'Other details', multiline: true },
      { key: 'lifeStory', label: 'Submitted life story', multiline: true },
    ],
  },
];

const detailKeys = sections.flatMap((section) => section.fields.map((field) => field.key));

function dateInputValue(value: string | null | undefined): string {
  if (!value) return '';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value.slice(0, 10) : parsed.toISOString().slice(0, 10);
}

interface ObituaryFormProps {
  initialValue?: ObituaryDraft;
  existingImageUrl?: string;
  requireSubmissionFields: boolean;
  saveLabel: string;
  submitting: boolean;
  error?: string;
  onCancel: () => void;
  onSave: (formData: FormData) => void;
}

export default function ObituaryForm({
  initialValue = {},
  existingImageUrl = '',
  requireSubmissionFields,
  saveLabel,
  submitting,
  error,
  onCancel,
  onSave,
}: ObituaryFormProps) {
  const initialFields = useMemo(() => {
    const values: Record<string, string> = {
      name: initialValue.name || '',
      content: initialValue.content || '',
      imageUrl: initialValue.imageUrl || '',
      publishedAt: initialValue.publishedAt ? new Date(initialValue.publishedAt).toISOString().slice(0, 16) : '',
    };
    for (const key of detailKeys) {
      const value = initialValue[key];
      values[key] = key === 'dateOfBirth' || key === 'dateOfDeath'
        ? dateInputValue(value)
        : key === 'maritalStatus'
          ? value?.toLowerCase() || ''
          : value || '';
    }
    return values;
  }, [initialValue]);
  const [values, setValues] = useState(initialFields);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewError, setImagePreviewError] = useState(false);
  const imagePreviewUrl = useMemo(
    () => imageFile ? URL.createObjectURL(imageFile) : existingImageUrl || values.imageUrl,
    [existingImageUrl, imageFile, values.imageUrl],
  );

  useEffect(() => () => {
    if (imageFile) URL.revokeObjectURL(imagePreviewUrl);
  }, [imageFile, imagePreviewUrl]);

  const displayName = [values.firstName, values.middleName, values.surname]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(' ') || values.otherNames.trim() || values.name.trim();
  const today = new Date().toISOString().slice(0, 10);

  const updateValue = (key: string, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
  };

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData();
    formData.append('name', displayName);
    formData.append('content', values.content);
    formData.append('imageUrl', values.imageUrl);
    if (values.publishedAt) formData.append('publishedAt', new Date(values.publishedAt).toISOString());
    for (const key of detailKeys) formData.append(key, values[key] || '');
    if (imageFile) formData.append('image', imageFile);
    onSave(formData);
  };

  return (
    <form onSubmit={submit} className="bg-white p-5 rounded-lg shadow mb-6 space-y-6">
      <div>
        <h2 className="text-lg font-semibold">{saveLabel}</h2>
        <p className="text-sm text-gray-500 mt-1">Review the submitted information and complete the publication details.</p>
      </div>

      {error && <p role="alert" className="bg-red-50 text-red-600 p-3 rounded text-sm">{error}</p>}

      <section className="space-y-4">
        <h3 className="font-semibold border-b pb-2">Photo and Publication</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="obituary-photo" className="block text-sm font-medium mb-1">Photo</label>
            <input
              id="obituary-photo"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(event) => {
                setImagePreviewError(false);
                setImageFile(event.target.files?.[0] || null);
              }}
              className="w-full border rounded px-3 py-2 text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">PNG, JPG, or WEBP; maximum 5 MB.</p>
            {imagePreviewUrl && !imagePreviewError && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imagePreviewUrl}
                alt="Obituary photo preview"
                onError={() => setImagePreviewError(true)}
                className="mt-3 max-h-56 max-w-full rounded object-contain"
              />
            )}
            {imagePreviewUrl && imagePreviewError && <p role="status" className="mt-2 text-sm text-red-600">The current photo could not be loaded.</p>}
          </div>
          <div>
            <label htmlFor="obituary-name" className="block text-sm font-medium mb-1">Publication name</label>
            <input
              id="obituary-name"
              value={displayName}
              readOnly
              required
              className="w-full border rounded px-3 py-2 text-sm bg-gray-50"
            />
            <p className="text-xs text-gray-500 mt-1">Automatically composed from the submitted first, middle, and last names.</p>
            <label htmlFor="obituary-content" className="block text-sm font-medium mt-4 mb-1">Publication content (written by admin)</label>
            <textarea
              id="obituary-content"
              value={values.content}
              onChange={(event) => updateValue('content', event.target.value)}
              required
              rows={6}
              placeholder="Write the approved obituary content for publication."
              className="w-full border rounded px-3 py-2 text-sm resize-y"
            />
            <label htmlFor="obituary-published-at" className="block text-sm font-medium mt-4 mb-1">Publication date</label>
            <input
              id="obituary-published-at"
              type="datetime-local"
              value={values.publishedAt}
              onChange={(event) => updateValue('publishedAt', event.target.value)}
              className="border rounded px-3 py-2 text-sm"
            />
          </div>
        </div>
      </section>

      {sections.map((section) => (
        <section key={section.title} className="space-y-4">
          <h3 className="font-semibold border-b pb-2">{section.title}</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {section.fields.map(({ key, label, multiline }) => {
              const isDate = key === 'dateOfBirth' || key === 'dateOfDeath';
              return (
                <div key={key} className={multiline ? 'sm:col-span-2' : undefined}>
                  <label htmlFor={`obituary-${key}`} className="block text-sm font-medium mb-1">{label}</label>
                  {key === 'maritalStatus' ? (
                    <select
                      id={`obituary-${key}`}
                      value={values[key]}
                      onChange={(event) => updateValue(key, event.target.value)}
                      className="w-full border rounded px-3 py-2 text-sm"
                    >
                      <option value="">Select marital status</option>
                      {['married', 'single', 'widowed', 'divorced', 'other'].map((status) => (
                        <option key={status} value={status}>{status.charAt(0).toUpperCase() + status.slice(1)}</option>
                      ))}
                    </select>
                  ) : multiline ? (
                    <textarea
                      id={`obituary-${key}`}
                      value={values[key]}
                      onChange={(event) => updateValue(key, event.target.value)}
                      rows={key === 'lifeStory' ? 5 : 3}
                      className="w-full border rounded px-3 py-2 text-sm resize-y"
                    />
                  ) : (
                    <input
                      id={`obituary-${key}`}
                      type={isDate ? 'date' : 'text'}
                      value={values[key]}
                      onChange={(event) => updateValue(key, event.target.value)}
                      required={requireSubmissionFields && (key === 'firstName' || key === 'dateOfDeath')}
                      max={key === 'dateOfDeath' ? today : key === 'dateOfBirth' ? values.dateOfDeath || today : undefined}
                      min={key === 'dateOfDeath' ? values.dateOfBirth || undefined : undefined}
                      className="w-full border rounded px-3 py-2 text-sm"
                    />
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}

      <div className="flex flex-wrap gap-2 border-t pt-4">
        <button type="submit" disabled={submitting || !displayName.trim()} className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50">
          {submitting ? 'Saving…' : saveLabel}
        </button>
        <button type="button" onClick={onCancel} disabled={submitting} className="bg-gray-200 px-4 py-2 rounded text-sm disabled:opacity-50">
          Cancel
        </button>
      </div>
    </form>
  );
}
