'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/contexts/PermissionsContext';
import { adminFetch, AdminApiError, toQueryString } from '@/lib/api';
import RichTextEditor from '@/components/RichTextEditor';

const UPLOADS_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api').replace(/\/api$/, '');

// ─── Types ───────────────────────────────────────────────────────────────────

interface Author {
  id: string;
  name: string;
  slug: string;
}

interface Category {
  id: string;
  name: string;
  slug: string;
}

interface Tag {
  id: string;
  name: string;
  slug: string;
}

interface Article {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  isBreaking: boolean;
  featuredImage: string | null;
  publishedAt: string | null;
  updatedAt: string;
  author: Author;
  category: Category;
  categoryId: string;
  tags: Tag[];
}

interface PaginatedArticles {
  data: Article[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

type ArticleStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

// ─── Field errors type ───────────────────────────────────────────────────────

interface FieldErrors {
  title?: string[];
  content?: string[];
  excerpt?: string[];
  categoryId?: string[];
  tagIds?: string[];
  featuredImage?: string[];
  isBreaking?: string[];
  status?: string[];
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function ArticlesPage() {
  const { token, user } = useAuth();
  const { canAction } = usePermissions();

  // List state
  const [articles, setArticles] = useState<PaginatedArticles | null>(null);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState('');

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formExcerpt, setFormExcerpt] = useState('');
  const [formCategoryId, setFormCategoryId] = useState('');
  const [formTagIds, setFormTagIds] = useState<string[]>([]);
  const [formFeaturedImage, setFormFeaturedImage] = useState('');
  const [formIsBreaking, setFormIsBreaking] = useState(false);
  const [formStatus, setFormStatus] = useState<ArticleStatus>('DRAFT');
  const [formError, setFormError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);

  // Image upload state
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Dropdown data
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);

  const isAuthor = user?.role === 'AUTHOR';

  // ─── Fetch articles ──────────────────────────────────────────────────────

  const fetchArticles = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setListError('');
    try {
      const params: Record<string, unknown> = { page, pageSize: 10 };
      if (statusFilter) {
        params.status = statusFilter;
      }

      if (!statusFilter) {
        // Fetch all statuses in parallel for "All" tab since backend defaults to PUBLISHED only
        const [draft, published, archived] = await Promise.all([
          adminFetch<PaginatedArticles>(`/articles${toQueryString({ page, pageSize: 10, status: 'DRAFT' })}`, { token }),
          adminFetch<PaginatedArticles>(`/articles${toQueryString({ page, pageSize: 10, status: 'PUBLISHED' })}`, { token }),
          adminFetch<PaginatedArticles>(`/articles${toQueryString({ page, pageSize: 10, status: 'ARCHIVED' })}`, { token }),
        ]);
        // Merge and sort by updatedAt desc
        const allData = [...draft.data, ...published.data, ...archived.data]
          .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
          .slice(0, 10);
        const total = draft.total + published.total + archived.total;
        setArticles({
          data: allData,
          total,
          page,
          pageSize: 10,
          totalPages: Math.ceil(total / 10),
        });
      } else {
        const data = await adminFetch<PaginatedArticles>(
          `/articles${toQueryString(params)}`,
          { token },
        );
        setArticles(data);
      }
    } catch (err) {
      setListError(err instanceof AdminApiError ? err.message : 'Failed to load articles');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, token]);

  // ─── Fetch categories and tags for dropdowns ─────────────────────────────

  const fetchDropdownData = useCallback(async () => {
    if (!token) return;
    try {
      const [cats, tgs] = await Promise.all([
        adminFetch<Category[]>('/categories', { token }),
        adminFetch<Tag[]>('/tags', { token }),
      ]);
      setCategories(cats);
      setTags(tgs);
    } catch {
      // Silently fail — dropdowns will be empty
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      fetchArticles();
      fetchDropdownData();
    }
  }, [fetchArticles, fetchDropdownData, token]);

  // ─── Form helpers ────────────────────────────────────────────────────────

  const resetForm = () => {
    setFormTitle('');
    setFormContent('');
    setFormExcerpt('');
    setFormCategoryId('');
    setFormTagIds([]);
    setFormFeaturedImage('');
    setFormIsBreaking(false);
    setFormStatus('DRAFT');
    setEditingId(null);
    setFormError('');
    setFieldErrors({});
    setShowForm(false);
    setImagePreview(null);
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  const openEditForm = (article: Article) => {
    setEditingId(article.id);
    setFormTitle(article.title);
    setFormContent(article.content);
    setFormExcerpt(article.excerpt || '');
    setFormCategoryId(article.categoryId || article.category?.id || '');
    setFormTagIds(article.tags?.map((t) => t.id) || []);
    setFormFeaturedImage(article.featuredImage || '');
    setFormIsBreaking(article.isBreaking);
    setFormStatus(article.status);
    setFormError('');
    setFieldErrors({});
    setShowForm(true);
    setImagePreview(article.featuredImage || null);
  };

  // ─── Image upload handler ─────────────────────────────────────────────────

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Show local preview immediately
    setImagePreview(URL.createObjectURL(file));
    setUploadingImage(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      const media = await adminFetch<{ originalUrl: string; mediumUrl: string | null }>('/media/upload', {
        token: token!,
        method: 'POST',
        body: formData,
      });
      // Store the full URL so the frontend can display it
      const imageUrl = `${UPLOADS_BASE}${media.mediumUrl || media.originalUrl}`;
      setFormFeaturedImage(imageUrl);
      setImagePreview(imageUrl);
    } catch (err) {
      setFormError(err instanceof AdminApiError ? err.message : 'Image upload failed');
      setImagePreview(null);
      setFormFeaturedImage('');
    } finally {
      setUploadingImage(false);
    }
  };

  // ─── Submit handler ──────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFieldErrors({});
    setSubmitting(true);

    const body: Record<string, unknown> = {
      title: formTitle,
      content: formContent,
      categoryId: formCategoryId,
      status: formStatus,
    };
    if (formExcerpt) body.excerpt = formExcerpt;
    if (formTagIds.length > 0) body.tagIds = formTagIds;
    if (formFeaturedImage) body.featuredImage = formFeaturedImage;
    body.isBreaking = formIsBreaking;

    try {
      if (editingId) {
        await adminFetch(`/articles/${editingId}`, {
          token: token!,
          method: 'PUT',
          body: JSON.stringify(body),
        });
      } else {
        await adminFetch('/articles', {
          token: token!,
          method: 'POST',
          body: JSON.stringify(body),
        });
      }
      resetForm();
      fetchArticles();
    } catch (err) {
      if (err instanceof AdminApiError) {
        setFormError(err.message);
        if (err.code === 'VALIDATION_ERROR' && err.details) {
          setFieldErrors(err.details as FieldErrors);
        }
      } else {
        setFormError('Network error');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Inline status change ────────────────────────────────────────────────

  const handleStatusChange = async (id: string, newStatus: string) => {
    if (!token) return;
    try {
      await adminFetch(`/articles/${id}`, {
        token,
        method: 'PUT',
        body: JSON.stringify({ status: newStatus }),
      });
      fetchArticles();
    } catch {
      // Silently fail — status will revert on next fetch
    }
  };

  // ─── Tag toggle helper ───────────────────────────────────────────────────

  const toggleTag = (tagId: string) => {
    setFormTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId],
    );
  };

  // ─── Can edit check (AUTHOR can only edit own articles) ──────────────────

  const canEditArticle = (article: Article): boolean => {
    if (!isAuthor) return true; // ADMIN and EDITOR can edit any
    return article.author?.id === user?.id;
  };

  // ─── Status badge ────────────────────────────────────────────────────────

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      DRAFT: 'bg-yellow-100 text-yellow-800',
      PUBLISHED: 'bg-green-100 text-green-800',
      ARCHIVED: 'bg-gray-100 text-gray-600',
    };
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[status] || 'bg-gray-100'}`}>
        {status}
      </span>
    );
  };

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Articles</h1>
        {canAction('articles', 'create') && (
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700"
        >
          + New Article
        </button>
        )}
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-3 mb-4">
        {[
          { value: '', label: 'All' },
          { value: 'DRAFT', label: 'Draft' },
          { value: 'PUBLISHED', label: 'Published' },
          { value: 'ARCHIVED', label: 'Archived' },
        ].map((tab) => (
          <button
            key={tab.value}
            onClick={() => { setStatusFilter(tab.value); setPage(1); }}
            className={`px-3 py-1 rounded text-sm ${
              statusFilter === tab.value
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Create/Edit form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white p-4 rounded-lg shadow mb-6 space-y-3">
          <h2 className="font-semibold">{editingId ? 'Edit Article' : 'New Article'}</h2>

          {formError && <p className="text-red-600 text-sm">{formError}</p>}

          {/* Title */}
          <div>
            <input
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              placeholder="Title"
              required
              className="w-full border rounded px-3 py-2 text-sm"
              aria-label="Article title"
            />
            {fieldErrors.title && (
              <p className="text-red-600 text-xs mt-1">{fieldErrors.title.join(', ')}</p>
            )}
          </div>

          {/* Content */}
          <div>
            <label className="block text-sm text-gray-600 mb-1">Content</label>
            <RichTextEditor
              value={formContent}
              onChange={setFormContent}
              placeholder="Write your article content..."
              rows={12}
            />
            {fieldErrors.content && (
              <p className="text-red-600 text-xs mt-1">{fieldErrors.content.join(', ')}</p>
            )}
          </div>

          {/* Excerpt */}
          <div>
            <textarea
              value={formExcerpt}
              onChange={(e) => setFormExcerpt(e.target.value)}
              placeholder="Excerpt (optional)"
              rows={2}
              className="w-full border rounded px-3 py-2 text-sm"
              aria-label="Article excerpt"
            />
            {fieldErrors.excerpt && (
              <p className="text-red-600 text-xs mt-1">{fieldErrors.excerpt.join(', ')}</p>
            )}
          </div>

          {/* Category dropdown */}
          <div>
            <select
              value={formCategoryId}
              onChange={(e) => setFormCategoryId(e.target.value)}
              required
              className="w-full border rounded px-3 py-2 text-sm"
              aria-label="Article category"
            >
              <option value="">Select category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            {fieldErrors.categoryId && (
              <p className="text-red-600 text-xs mt-1">{fieldErrors.categoryId.join(', ')}</p>
            )}
          </div>

          {/* Tags multi-select */}
          <div>
            <label className="block text-sm text-gray-600 mb-1">Tags</label>
            <div className="flex flex-wrap gap-2 border rounded px-3 py-2 min-h-[38px]">
              {tags.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => toggleTag(t.id)}
                  className={`px-2 py-0.5 rounded text-xs ${
                    formTagIds.includes(t.id)
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                  aria-label={`Tag ${t.name}`}
                  aria-pressed={formTagIds.includes(t.id)}
                >
                  {t.name}
                </button>
              ))}
              {tags.length === 0 && <span className="text-gray-400 text-xs">No tags available</span>}
            </div>
            {fieldErrors.tagIds && (
              <p className="text-red-600 text-xs mt-1">{fieldErrors.tagIds.join(', ')}</p>
            )}
          </div>

          {/* Featured image — upload or URL */}
          <div>
            <label className="block text-sm text-gray-600 mb-1">Featured Image</label>
            {imagePreview ? (
              <div className="flex items-start gap-3">
                <div className="w-32 h-20 rounded-lg overflow-hidden bg-gray-100 border shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                </div>
                <div className="flex flex-col gap-1.5">
                  {uploadingImage && <p className="text-xs text-blue-600">Uploading…</p>}
                  {!uploadingImage && formFeaturedImage && <p className="text-xs text-green-600">✓ Image set</p>}
                  <button type="button" onClick={() => imageInputRef.current?.click()} className="text-xs text-blue-600 hover:underline">Change image</button>
                  <button
                    type="button"
                    onClick={() => { setImagePreview(null); setFormFeaturedImage(''); if (imageInputRef.current) imageInputRef.current.value = ''; }}
                    className="text-xs text-red-600 hover:underline"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {/* Upload option */}
                <div
                  onClick={() => imageInputRef.current?.click()}
                  className="flex items-center gap-3 border-2 border-dashed border-gray-300 rounded-lg px-4 py-3 cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-colors"
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') imageInputRef.current?.click(); }}
                >
                  <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
                  </svg>
                  <div>
                    <p className="text-sm text-gray-700">Upload image</p>
                    <p className="text-xs text-gray-400">JPEG, PNG, WebP or AVIF</p>
                  </div>
                </div>
                {/* OR divider */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-gray-200" />
                  <span className="text-xs text-gray-400">OR</span>
                  <div className="flex-1 h-px bg-gray-200" />
                </div>
                {/* URL input */}
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={formFeaturedImage}
                    onChange={(e) => {
                      setFormFeaturedImage(e.target.value);
                      setImagePreview(e.target.value || null);
                    }}
                    placeholder="Paste image URL (e.g. from Media Library)"
                    className="flex-1 border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  {formFeaturedImage && !imagePreview && (
                    <button type="button" onClick={() => setImagePreview(formFeaturedImage)} className="text-xs text-blue-600 hover:underline px-2">Preview</button>
                  )}
                </div>
              </div>
            )}
            <input
              ref={imageInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              className="hidden"
              onChange={handleImageUpload}
              aria-label="Featured image"
            />
            {fieldErrors.featuredImage && (
              <p className="text-red-600 text-xs mt-1">{fieldErrors.featuredImage.join(', ')}</p>
            )}
          </div>

          {/* Breaking news toggle + Status */}
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={formIsBreaking}
                onChange={(e) => setFormIsBreaking(e.target.checked)}
                aria-label="Breaking news"
              />
              Breaking news
            </label>

            <select
              value={formStatus}
              onChange={(e) => setFormStatus(e.target.value as ArticleStatus)}
              className="border rounded px-3 py-2 text-sm"
              aria-label="Article status"
            >
              <option value="DRAFT">Draft</option>
              <option value="PUBLISHED">Published</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </div>

          {/* Form actions */}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="bg-gray-200 px-4 py-2 rounded text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* List error */}
      {listError && (
        <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm flex justify-between items-center">
          <span>{listError}</span>
          <button onClick={fetchArticles} className="text-red-700 underline text-xs">Retry</button>
        </div>
      )}

      {/* Article list */}
      {loading ? (
        <p className="text-gray-500 text-sm">Loading…</p>
      ) : !articles || articles.data.length === 0 ? (
        <p className="text-gray-500 text-sm">No articles found.</p>
      ) : (
        <>
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="text-left px-4 py-2">Title</th>
                  <th className="text-left px-4 py-2">Author</th>
                  <th className="text-left px-4 py-2">Category</th>
                  <th className="text-left px-4 py-2">Status</th>
                  <th className="text-left px-4 py-2">Updated</th>
                  <th className="text-left px-4 py-2">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {articles.data.map((a) => (
                  <tr key={a.id}>
                    <td className="px-4 py-2 max-w-xs truncate">{a.title}</td>
                    <td className="px-4 py-2">{a.author?.name}</td>
                    <td className="px-4 py-2">{a.category?.name}</td>
                    <td className="px-4 py-2">
                      {canEditArticle(a) && canAction('articles', 'publish') ? (
                        <select
                          value={a.status}
                          onChange={(e) => handleStatusChange(a.id, e.target.value)}
                          className="border rounded px-2 py-1 text-xs"
                          aria-label={`Status for ${a.title}`}
                        >
                          <option value="DRAFT">Draft</option>
                          <option value="PUBLISHED">Published</option>
                          <option value="ARCHIVED">Archived</option>
                        </select>
                      ) : (
                        statusBadge(a.status)
                      )}
                    </td>
                    <td className="px-4 py-2 text-gray-500">
                      {new Date(a.updatedAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2">
                      {canEditArticle(a) && canAction('articles', 'edit') && (
                        <button
                          onClick={() => openEditForm(a)}
                          className="text-blue-600 hover:underline text-xs"
                        >
                          Edit
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex justify-between items-center mt-4 text-sm">
            <span className="text-gray-500">
              Page {articles.page} of {articles.totalPages} ({articles.total} total)
            </span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="px-3 py-1 rounded bg-gray-200 disabled:opacity-50"
              >
                Prev
              </button>
              <button
                disabled={page >= articles.totalPages}
                onClick={() => setPage(page + 1)}
                className="px-3 py-1 rounded bg-gray-200 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
