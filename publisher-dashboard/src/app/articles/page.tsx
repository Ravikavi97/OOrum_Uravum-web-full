'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/contexts/PermissionsContext';
import { adminFetch, AdminApiError, toQueryString } from '@/lib/api';
import RichTextEditor from '@/components/RichTextEditor';
import ImageUploadField from '@/components/ImageUploadField';
import { ToastContainer, useToast } from '@/components/Toast';

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
  const { toasts, showToast, dismiss } = useToast();

  // List state
  const [articles, setArticles] = useState<PaginatedArticles | null>(null);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState('');

  // Delete state
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteTitle, setDeleteTitle] = useState('');
  const [deleting, setDeleting] = useState(false);

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
  const [uploadingImage, setUploadingImage] = useState(false);

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
        const updated = await adminFetch<Article>(`/articles/${editingId}`, {
          token: token!,
          method: 'PUT',
          body: JSON.stringify(body),
        });
        // Update local state directly — no re-fetch needed
        setArticles(prev => prev ? {
          ...prev,
          data: prev.data.map(a => a.id === editingId ? updated : a),
        } : null);
      } else {
        const created = await adminFetch<Article>('/articles', {
          token: token!,
          method: 'POST',
          body: JSON.stringify(body),
        });
        // Prepend new article to list
        setArticles(prev => prev ? {
          ...prev,
          data: [created, ...prev.data].slice(0, 10),
          total: prev.total + 1,
          totalPages: Math.ceil((prev.total + 1) / 10),
        } : null);
      }
      resetForm();
      showToast(editingId ? 'Article updated successfully' : 'Article created successfully');
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
    // Optimistic update — change status locally first
    setArticles(prev => prev ? {
      ...prev,
      data: prev.data.map(a => a.id === id ? { ...a, status: newStatus as Article['status'] } : a),
    } : null);
    try {
      await adminFetch(`/articles/${id}`, {
        token,
        method: 'PUT',
        body: JSON.stringify({ status: newStatus }),
      });
      // No re-fetch needed — local state is already correct
    } catch {
      // On error revert by re-fetching
      fetchArticles();
      showToast('Failed to update status', 'error');
    }
  };

  // ─── Delete article ──────────────────────────────────────────────────────

  const confirmDelete = (article: Article) => {
    setDeleteId(article.id);
    setDeleteTitle(article.title);
  };

  const handleDelete = async () => {
    if (!deleteId || !token) return;
    setDeleting(true);

    // Optimistic update — remove from local state immediately
    setArticles(prev => prev ? {
      ...prev,
      data: prev.data.filter(a => a.id !== deleteId),
      total: prev.total - 1,
      totalPages: Math.max(1, Math.ceil((prev.total - 1) / 10)),
    } : null);
    const idToDelete = deleteId;
    setDeleteId(null);
    setDeleteTitle('');

    try {
      await adminFetch(`/articles/${idToDelete}`, {
        token,
        method: 'DELETE',
      });
      showToast('Article deleted successfully');
      // No re-fetch — local state is already up-to-date
    } catch (err) {
      // Revert optimistic update on error by re-fetching from server
      fetchArticles();
      showToast(err instanceof AdminApiError ? err.message : 'Failed to delete article', 'error');
    } finally {
      setDeleting(false);
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
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Articles</h1>
        <div className="flex gap-2 items-center">
          <button
            onClick={() => fetchArticles()}
            disabled={loading}
            className="text-gray-500 hover:text-gray-700 p-2 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Refresh articles list"
            title="Refresh"
          >
            <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          {canAction('articles', 'create') && (
          <button
            onClick={() => { resetForm(); setShowForm(true); }}
            className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700"
          >
            + New Article
          </button>
          )}
        </div>
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

          {/* Featured image */}
          <ImageUploadField
            label="Featured Image"
            value={formFeaturedImage}
            onChange={setFormFeaturedImage}
            onUploadingChange={setUploadingImage}
            prefer="medium"
          />
          {fieldErrors.featuredImage && (
            <p className="text-red-600 text-xs mt-1">{fieldErrors.featuredImage.join(', ')}</p>
          )}

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
              disabled={submitting || uploadingImage}
              className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {uploadingImage ? 'Uploading image…' : submitting ? 'Saving…' : 'Save'}
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
                      <div className="flex items-center gap-2">
                        {canEditArticle(a) && canAction('articles', 'edit') && (
                          <button
                            onClick={() => openEditForm(a)}
                            className="text-blue-600 hover:underline text-xs"
                          >
                            Edit
                          </button>
                        )}
                        {canAction('articles', 'delete') && (
                          <button
                            onClick={() => confirmDelete(a)}
                            className="text-red-500 hover:underline text-xs"
                            aria-label={`Delete ${a.title}`}
                          >
                            Delete
                          </button>
                        )}
                      </div>
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

      {/* Delete confirmation modal */}
      {deleteId && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => !deleting && setDeleteId(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-modal-title"
        >
          <div
            className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 rounded-full bg-red-100">
              <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h3 id="delete-modal-title" className="text-lg font-bold text-gray-900 text-center mb-2">
              Delete Article?
            </h3>
            <p className="text-sm text-gray-500 text-center mb-1">
              You are about to permanently delete:
            </p>
            <p className="text-sm font-medium text-gray-800 text-center mb-6 line-clamp-2 px-2">
              &ldquo;{deleteTitle}&rdquo;
            </p>
            <p className="text-xs text-red-600 text-center mb-6 bg-red-50 rounded-lg p-2">
              ⚠ This cannot be undone. The article will be permanently removed from the database.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteId(null)}
                disabled={deleting}
                className="flex-1 bg-gray-100 text-gray-700 px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-200 disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 bg-red-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {deleting ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Deleting…
                  </>
                ) : 'Delete Article'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
