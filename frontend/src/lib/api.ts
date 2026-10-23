/**
 * API client – all calls go through /api/v1 (Vite proxy in dev).
 */

const BASE = '/api/v1';

export interface ApiError {
  code: string;
  message: string;
  retryable: boolean;
  request_id?: string;
}

class ApiClient {
  private async request<T>(
    path: string,
    options: RequestInit = {},
  ): Promise<T> {
    const url = `${BASE}${path}`;
    const headers: Record<string, string> = {
      ...((options.headers as Record<string, string>) || {}),
    };
    if (!(options.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    const res = await fetch(url, {
      credentials: 'include',
      headers,
      ...options,
    }).catch(() => {
      const error = new Error('The backend is unavailable. Check that the local services are running.');
      if (!path.startsWith('/auth/')) window.dispatchEvent(new CustomEvent('api-error', { detail: error.message }));
      throw error;
    });

    if (res.status === 401 && !path.startsWith('/auth/')) {
      // Session expired – redirect to login
      window.location.href = '/login';
      throw new Error('Session expired');
    }

    if (!res.ok) {
      let err: any;
      try {
        const data = await res.json();
        if (data.detail && typeof data.detail === 'object' && data.detail.message) {
          err = data.detail;
        } else if (data.detail && typeof data.detail === 'string') {
          err = { code: 'UNKNOWN', message: data.detail, retryable: false };
        } else {
          err = data;
        }
      } catch {
        err = { code: 'UNKNOWN', message: res.statusText, retryable: false };
      }
      if (!path.startsWith('/auth/')) window.dispatchEvent(new CustomEvent('api-error', { detail: err.message }));
      throw err;
    }

    // 202 / 204 may have no body
    if (res.status === 204 || res.headers.get('content-length') === '0') {
      return undefined as T;
    }

    return res.json();
  }

  // Allow raw requests for components that need them
  public rawRequest<T>(path: string, options?: RequestInit) {
    return this.request<T>(path, options);
  }

  // ── Auth ──
  login(email: string, password: string) {
    return this.request<{ id: string; username: string; display_name: string | null; avatar_url: string | null }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  register(email: string, username: string, password: string) {
    return this.request<{ message: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, username, password }),
    });
  }

  verifyEmail(email: string, code: string) {
    return this.request<{ id: string; username: string; display_name: string | null; avatar_url: string | null }>('/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ email, code }),
    });
  }

  resendVerificationCode(email: string) {
    return this.request<{ message: string }>('/auth/resend-code', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  forgotPassword(email: string) {
    return this.request<{ message: string }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  resetPassword(email: string, code: string, new_password: string) {
    return this.request<{ message: string }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ email, code, new_password }),
    });
  }

  logout() {
    return this.request<void>('/auth/logout', { method: 'POST' });
  }

  me() {
    return this.request<{ id: string; username: string; display_name: string | null; avatar_url: string | null }>('/auth/me');
  }

  // ── Dashboard ──
  dashboard() {
    return this.request<{
      total_chats: number;
      ready_documents: number;
      indexed_pages: number;
      saved_topics: number;
      recent_chats: Array<{ id: string; title: string; updated_at: string }>;
    }>('/dashboard');
  }

  getUserAiUsage(range?: string, startDate?: string, endDate?: string) {
    const qs = new URLSearchParams();
    if (range) qs.set('range', range);
    if (startDate) qs.set('start_date', startDate);
    if (endDate) qs.set('end_date', endDate);
    const queryString = qs.toString() ? `?${qs.toString()}` : '';
    return this.request<{
      time_series: Array<{ date: string; queries: number; input_tokens: number; output_tokens: number }>;
    }>(`/users/me/analytics/ai-usage${queryString}`);
  }

  getUserDocAnalytics(range?: string, startDate?: string, endDate?: string) {
    const qs = new URLSearchParams();
    if (range) qs.set('range', range);
    if (startDate) qs.set('start_date', startDate);
    if (endDate) qs.set('end_date', endDate);
    const queryString = qs.toString() ? `?${qs.toString()}` : '';
    return this.request<{
      time_series: Array<{ date: string; docs_processed: number; pages_processed: number }>;
    }>(`/users/me/analytics/documents${queryString}`);
  }
  // ── Chats ──
  getChats(params?: { search?: string; cursor?: string; limit?: number }) {
    const q = new URLSearchParams();
    if (params?.search) q.set('search', params.search);
    if (params?.cursor) q.set('cursor', params.cursor);
    if (params?.limit) q.set('limit', String(params.limit));
    const qs = q.toString();
    return this.request<{
      items: Array<{
        id: string;
        title: string;
        created_at: string;
        updated_at: string;
        document_count: number;
        message_count: number;
      }>;
      next_cursor: string | null;
    }>(`/chats${qs ? `?${qs}` : ''}`);
  }

  createChat(title?: string) {
    return this.request<{ id: string; title: string }>('/chats', {
      method: 'POST',
      body: JSON.stringify({ title }),
    });
  }

  getChat(chatId: string) {
    return this.request<{
      id: string;
      title: string;
      documents: Array<{ id: string; original_filename: string; status: string }>;
      active_job: string | null;
    }>(`/chats/${chatId}`);
  }

  getChatJobs(chatId: string) {
    return this.request<{
      items: Array<{
        id: string;
        type: string;
        status: string;
        progress: any;
        error_code: string | null;
        payload: any;
        created_at: string;
        updated_at: string;
      }>;
    }>(`/chats/${chatId}/jobs`);
  }

  renameChat(chatId: string, title: string) {
    return this.request<{ id: string; title: string }>(`/chats/${chatId}`, {
      method: 'PATCH',
      body: JSON.stringify({ title }),
    });
  }

  deleteChat(chatId: string) {
    return this.request<void>(`/chats/${chatId}`, { method: 'DELETE' });
  }

  // ── Messages ──
  getMessages(chatId: string, cursor?: string) {
    const qs = cursor ? `?cursor=${cursor}` : '';
    return this.request<{
      items: Array<{
        id: string;
        role: string;
        content: string;
        status: string;
        feedback: number | null;
        created_at: string;
        updated_at: string;
        sources: Array<{
          citation_label: string;
          page_number: number;
          excerpt: string;
          document_id: string;
          original_filename: string;
        }>;
      }>;
      next_cursor: string | null;
    }>(`/chats/${chatId}/messages${qs}`);
  }

  sendMessage(chatId: string, content: string, documentIds?: string[]) {
    return this.request<{ message_id: string; job_id: string | null }>(`/chats/${chatId}/messages`, {
      method: 'POST',
      body: JSON.stringify({
        content,
        document_ids: documentIds,
        client_request_id: crypto.randomUUID(),
      }),
    });
  }

  editMessage(chatId: string, messageId: string, content: string, documentIds?: string[]) {
    return this.request<{ message_id: string; job_id: string }>(`/chats/${chatId}/messages/${messageId}`, {
      method: 'PUT',
      body: JSON.stringify({
        content,
        document_ids: documentIds,
        client_request_id: crypto.randomUUID(),
      }),
    });
  }

  deleteMessage(chatId: string, messageId: string) {
    return this.request<{ status: string }>(`/chats/${chatId}/messages/${messageId}`, {
      method: 'DELETE',
    });
  }

  sendFeedback(chatId: string, messageId: string, feedback: number) {
    return this.request<{ status: string; feedback: number }>(`/chats/${chatId}/messages/${messageId}/feedback`, {
      method: 'POST',
      body: JSON.stringify({ feedback }),
    });
  }

  // ── Documents ──
  getChatDocuments(chatId: string) {
    return this.request<{
      items: Array<{
        id: string;
        original_filename: string;
        byte_size: number;
        page_count: number | null;
        status: string;
        created_at: string;
      }>;
    }>(`/chats/${chatId}/documents`);
  }

  uploadDocument(chatId: string, file: File) {
    const formData = new FormData();
    formData.append('file', file);

    return this.request<{ document_id: string; job_id: string }>(
      `/chats/${chatId}/documents`,
      {
        method: 'POST',
        headers: {}, // Let browser set Content-Type with boundary
        body: formData,
      },
    );
  }

  getAllDocuments(params?: { status?: string; chat_id?: string }) {
    const q = new URLSearchParams();
    if (params?.status) q.set('status', params.status);
    if (params?.chat_id) q.set('chat_id', params.chat_id);
    const qs = q.toString();
    return this.request<{
      items: Array<{
        id: string;
        original_filename: string;
        byte_size: number;
        page_count: number | null;
        status: string;
        chat_id: string;
        chat_title: string;
        created_at: string;
      }>;
    }>(`/documents${qs ? `?${qs}` : ''}`);
  }

  deleteDocument(documentId: string) {
    return this.request<void>(`/documents/${documentId}`, { method: 'DELETE' });
  }

  addDocumentToChat(documentId: string, chatId: string) {
    return this.request<{
      document_id: string;
      job_id: string;
      chat_id: string;
      chat_title: string;
    }>(`/documents/${documentId}/add-to-chat`, {
      method: 'POST',
      body: JSON.stringify({ chat_id: chatId }),
    });
  }

  // ── Flashcards ──
  getChatFlashcards(chatId: string) {
    return this.request<Array<{
      id: string;
      flashcard_set_id: string;
      question: string;
      answer: string;
      difficulty: string;
      repetitions: number;
      review_interval: number;
      ease_factor: number;
      next_review_at: string;
      last_reviewed_at: string | null;
      review_count: number;
    }>>(`/chats/${chatId}/flashcards`);
  }

  getChatFlashcardStats(chatId: string) {
    return this.request<{
      reviewed_today: number;
      recent_accuracy: number | null;
      total_reviews: number;
    }>(`/chats/${chatId}/flashcards/stats`);
  }

  submitFlashcardReview(flashcardId: string, rating: string) {
    return this.request<{
      id: string;
      flashcard_id: string;
      rating: string;
      previous_interval: number;
      new_interval: number;
      reviewed_at: string;
    }>(`/flashcards/${flashcardId}/review`, {
      method: 'POST',
      body: JSON.stringify({ rating }),
    });
  }

  generateFlashcards(chatId: string, documentIds: string[], count: number, topic?: string) {
    return this.request<{ flashcard_set_id: string; job_id: string }>(`/chats/${chatId}/flashcards/generate`, {
      method: 'POST',
      body: JSON.stringify({ document_ids: documentIds, count, topic }),
    });
  }

  deleteFlashcard(flashcardId: string) {
    return this.request<void>(`/flashcards/${flashcardId}`, { method: 'DELETE' });
  }

  // ── Jobs ──
  getJob(jobId: string) {
    return this.request<{
      id: string;
      type: string;
      status: string;
      progress: Record<string, unknown> | null;
      error_code: string | null;
    }>(`/jobs/${jobId}`);
  }

  cancelJob(jobId: string) {
    return this.request<void>(`/jobs/${jobId}/cancel`, { method: 'POST' });
  }

  retryJob(jobId: string) {
    return this.request<{ job_id: string }>(`/jobs/${jobId}/retry`, { method: 'POST' });
  }

  documentDetail(documentId: string) {
    return this.request<{ jobs: Array<{ id: string; type: string; status: string; error_code: string; progress: { pages?: number; total?: number } }> }>(`/documents/${documentId}`);
  }

  // ── Topics ──
  getChatTopicSets(chatId: string) {
    return this.request<{
      items: Array<{
        id: string;
        status: string;
        job_id: string | null;
        job_status: string | null;
        progress: { stage?: string; chunks?: number; total?: number; generated_chars?: number } | null;
        error_code: string | null;
        heartbeat_at: string | null;
        completed_at: string | null;
        covered_pages: unknown;
        created_at: string;
        topics: Array<{
          id: string;
          title: string;
          description: string;
          importance_reason: string;
          rank: number;
          sources_json: unknown;
        }>;
      }>;
    }>(`/chats/${chatId}/topic-sets`);
  }

  createTopicSet(chatId: string, documentIds: string[], count?: number, pageRange?: { start: number; end: number }, topic?: string) {
    return this.request<{ topic_set_id: string; job_id: string }>(
      `/chats/${chatId}/topic-sets`,
      {
        method: 'POST',
        body: JSON.stringify({ document_ids: documentIds, count: count ?? 15, page_range: pageRange, topic }),
      },
    );
  }

  expandTopicBranch(chatId: string, topicSetId: string, topicId: string) {
    return this.request<{ job_id: string }>(`/chats/${chatId}/topic_sets/${topicSetId}/topics/${topicId}/expand`, {
      method: 'POST',
    });
  }

  generateConceptMap(chatId: string, topicSetId: string) {
    return this.request<{ job_id: string }>(`/chats/${chatId}/topic_sets/${topicSetId}/mindmap/generate`, {
      method: 'POST',
    });
  }

  getConceptMapEdges(chatId: string, topicSetId: string) {
    return this.request<any[]>(`/chats/${chatId}/topic_sets/${topicSetId}/mindmap`);
  }

  // ── Quiz ──
  getChatQuizSets(chatId: string) {
    return this.request<{
      items: Array<{
        id: string;
        status: string;
        difficulty: string;
        job_id: string | null;
        job_status: string | null;
        progress: { stage?: string; chunks?: number; total?: number; generated_chars?: number } | null;
        error_code: string | null;
        heartbeat_at: string | null;
        completed_at: string | null;
        covered_pages: unknown;
        created_at: string;
        questions: Array<{
          id: string;
          rank: number;
          question: string;
          option_a: string;
          option_b: string;
          option_c: string;
          option_d: string;
          correct_option: string;
          explanation: string | null;
          sources_json: unknown;
        }>;
      }>;
    }>(`/chats/${chatId}/quiz-sets`);
  }

  createQuizSet(chatId: string, documentIds: string[], count?: number, difficulty: string = "medium", pageRange?: { start: number; end: number }, topic?: string) {
    return this.request<{ quiz_set_id: string; job_id: string }>(
      `/chats/${chatId}/quiz-sets`,
      {
        method: 'POST',
        body: JSON.stringify({ document_ids: documentIds, count: count ?? 10, difficulty, page_range: pageRange, topic }),
      },
    );
  }

  // ── Admin ──
  getAdminUsers() {
    return this.request<{ users: Array<{ id: string; username: string; is_active: boolean; created_at: string }> }>('/admin/users');
  }

  createAdminUser(data: { username: string; password: string }) {
    return this.request<{ id: string }>('/admin/users', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  updateAdminUser(userId: string, data: { username?: string; password?: string; is_active?: boolean; storage_quota_bytes?: number | null }) {
    return this.request<void>(`/admin/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  deleteAdminUser(userId: string) {
    return this.request<void>(`/admin/users/${userId}`, {
      method: 'DELETE',
    });
  }



  // New method: get full user detail
  getAdminUserDetail(userId: string) {
    return this.request<any>(`/admin/users/${userId}/detail`);
  }

  // New method: force logout
  adminForceLogout(userId: string) {
    return this.request<void>(`/admin/users/${userId}/force-logout`, { method: 'POST' });
  }

  // New method: reset quota
  adminResetQuota(userId: string) {
    return this.updateAdminUser(userId, { storage_quota_bytes: 0 });
  }

  // New method: set custom quota
  adminSetQuota(userId: string, bytes: number) {
    return this.request<void>(`/admin/users/${userId}`, {
      method: 'PUT', body: JSON.stringify({ storage_quota_bytes: bytes })
    });
  }

  // New method: soft-delete
  adminSoftDelete(userId: string) {
    return this.request<void>(`/admin/users/${userId}/soft-delete`, { method: 'POST' });
  }

  // New method: restore soft-deleted
  adminRestoreUser(userId: string) {
    return this.request<void>(`/admin/users/${userId}/restore`, { method: 'POST' });
  }

  getAdminDocuments(statusFilter?: string) {
    const params = statusFilter && statusFilter !== 'all' ? `?status_filter=${statusFilter}` : '';
    return this.request<{ documents: Array<any>; counts?: Record<string, number> }>(`/admin/documents${params}`);
  }

  getAdminDocumentDetail(documentId: string) {
    return this.request<AdminDocumentDetailData>(`/admin/documents/${documentId}/detail`);
  }

  adminReprocessDocument(documentId: string) {
    return this.request<{ job_id: string }>(`/admin/documents/${documentId}/reprocess`, { method: 'POST' });
  }

  adminReindexDocument(documentId: string) {
    return this.request<{ job_id: string }>(`/admin/documents/${documentId}/reindex`, { method: 'POST' });
  }

  adminRestoreDocument(documentId: string) {
    return this.request<void>(`/admin/documents/${documentId}/restore`, { method: 'POST' });
  }

  adminPermanentDeleteDocument(documentId: string) {
    return this.request<void>(`/admin/documents/${documentId}/permanent`, { method: 'DELETE' });
  }

  updateAdminDocument(documentId: string, data: { original_filename: string }) {
    return this.request<void>(`/admin/documents/${documentId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  deleteAdminDocument(documentId: string) {
    return this.request<{ job_id: string }>(`/admin/documents/${documentId}`, {
      method: 'DELETE',
    });
  }
  
  getAdminDocumentDownloadUrl(documentId: string) {
    return `${BASE}/admin/documents/${documentId}/file`;
  }

  getAdminDashboard() {
    return this.request<{
      users: { total: number; active_today: number; active_week: number; new_month: number };
      documents: { total: number; ready: number; processing: number; failed: number; ocr_processed: number };
      queries: { total: number; today: number; last_7d: number; avg_per_user: number };
      storage: { pdf_bytes: number; chroma_bytes: number; db_bytes: number; disk_free_bytes: number; disk_total_bytes: number };
      jobs: { running: number; queued: number; failed: number; complete_today: number };
      system: { ollama: string; chroma: string; postgres: string; worker: string };
      total_users: number;
      total_documents: number;
      total_ai_queries: number;
      storage_used_bytes: number;
      recent_users: Array<{ id: string; username: string; created_at: string }>;
      recent_documents: Array<{ id: string; original_filename: string; username: string; created_at: string }>;
    }>('/admin/dashboard');
  }

  getAdminRagAnalytics() {
    return this.request<{
      total_queries: number;
      avg_docs_retrieved: number;
      semantic_success: number;
      bm25_success: number;
      avg_latency: number;
      pipeline: {
        embed_ms: number;
        vector_search_ms: number;
        bm25_ms: number;
        rrf_ms: number;
        rerank_ms: number;
        llm_ms: number;
        total_ms: number;
      };
      citations: {
        success_rate: number;
        repair_rate: number;
        no_context_rate: number;
        avg_sources: number;
        avg_context_chunks: number;
      };
      recent_queries: Array<{
        id: string;
        username: string;
        preview: string;
        total_ms: number;
        sources: number;
        created_at: string;
      }>;
    }>('/admin/analytics/rag');
  }

  getAdminRagQueryDetail(id: string) {
    return this.request<{
      id: string;
      user: { id: string; username: string; email: string };
      question: string;
      answer: string | null;
      documents: Array<{ id: string; chat_id: string; filename: string; byte_size: number; page_count: number }>;
      metrics: {
        total_ms: number;
        sources: number;
        embed_ms: number;
        vector_search_ms: number;
        bm25_ms: number;
        rerank_ms: number;
        llm_ms: number;
        rrf_ms: number;
        semantic_results: number;
        bm25_results: number;
        merged_results: number;
        reranked_results: number;
      };
      created_at: string;
    }>(`/admin/analytics/rag/${id}`);
  }

  getAdminRagQueries(params: { page: number; limit: number; user_search?: string; keyword?: string; date_from?: string; date_to?: string }) {
    const qs = new URLSearchParams();
    qs.append('page', params.page.toString());
    qs.append('limit', params.limit.toString());
    if (params.user_search) qs.append('user_search', params.user_search);
    if (params.keyword) qs.append('keyword', params.keyword);
    if (params.date_from) qs.append('date_from', params.date_from);
    if (params.date_to) qs.append('date_to', params.date_to);

    return this.request<{
      items: Array<{
        id: string;
        username: string;
        preview: string;
        total_ms: number;
        sources: number;
        created_at: string;
      }>;
      total: number;
      page: number;
      limit: number;
      total_pages: number;
    }>(`/admin/analytics/rag/queries?${qs.toString()}`);
  }

  getAdminAiUsage(range?: string) {
    const qs = range ? `?range=${range}` : '';
    return this.request<{
      kpis: {
        total_queries: number;
        input_tokens: number;
        output_tokens: number;
        avg_response_time: number;
        avg_tokens_per_query: number;
        failed_generations: number;
      };
      time_series: {
        daily: Array<{ date: string; queries: number; input: number; output: number }>;
      };
      by_user: Array<{
        username: string;
        queries: number;
        input_tokens: number;
        output_tokens: number;
        avg_latency_ms: number;
      }>;
      by_type: Array<{ type: string; count: number; percentage: number }>;
      usage: Array<{ date: string; tokens_used: number; active_users: number }>;
    }>(`/admin/analytics/ai-usage${qs}`);
  }

  // ── Admin Storage ──
  getAdminStorageStats() {
    return this.request<{
      overview: {
        pdf_size_bytes: number;
        chroma_size_bytes: number;
        postgres_size_bytes: number;
        temp_size_bytes: number;
        total_size_bytes: number;
      };
      chromadb: {
        collections_count: number;
        vector_count: number;
        index_size_bytes: number;
        embedding_dimension: number;
        orphaned_vectors: number;
      };
      postgres: {
        database_size_bytes: number;
        counts: {
          users: number;
          chats: number;
          messages: number;
          documents: number;
          jobs: number;
          audit_entries: number;
        };
      };
    }>('/admin/storage/stats');
  }

  adminCleanupTemp() {
    return this.request<{ message: string; deleted_files: number; freed_bytes: number }>('/admin/storage/cleanup/temp', { method: 'POST' });
  }

  adminCleanupJobs() {
    return this.request<{ message: string; deleted_jobs: number }>('/admin/storage/cleanup/expired-jobs', { method: 'POST' });
  }

  adminCleanupOrphans() {
    return this.request<{ message: string; deleted_files: number; freed_bytes: number }>('/admin/storage/cleanup/orphaned-docs', { method: 'POST' });
  }

  adminCleanupSoftDeleted(daysOld: number) {
    return this.request<{ message: string; deleted_chats: number; deleted_docs: number }>('/admin/storage/cleanup/soft-deleted', {
      method: 'POST',
      body: JSON.stringify({ days_old: daysOld })
    });
  }

  // ── Profile ──
  getProfile() {
    return this.request<{
      username: string;
      display_name: string | null;
      email: string | null;
      phone_number: string | null;
      date_of_birth: string | null;
      age: number | null;
      bio: string | null;
      institution: string | null;
      course: string | null;
      avatar_url: string | null;
      member_since: string;
      version: number;
    }>('/users/me/profile');
  }

  updateProfile(data: {
    username?: string | null;
    display_name?: string | null;
    phone_number?: string | null;
    date_of_birth?: string | null;
    bio?: string | null;
    institution?: string | null;
    course?: string | null;
    version: number;
  }) {
    return this.request<ReturnType<typeof this.getProfile> extends Promise<infer R> ? R : never>(
      '/users/me/profile',
      { method: 'PATCH', body: JSON.stringify(data) }
    );
  }

  // ── Preferences ──
  getPreferences() {
    return this.request<{ 
      theme: string; 
      accent_color: string; 
      response_length: string;
      explanation_level: string;
      not_in_docs_behavior: string;
      citation_style: string;
      default_search_scope: string;
      follow_up_suggestions: boolean;
      simplify_difficult_concepts: boolean;
      external_knowledge: boolean;
      answer_format: string;
      version: number 
    }>(
      '/users/me/preferences'
    );
  }

  updatePreferences(data: { 
    theme?: string; 
    accent_color?: string; 
    response_length?: string;
    explanation_level?: string;
    not_in_docs_behavior?: string;
    citation_style?: string;
    default_search_scope?: string;
    follow_up_suggestions?: boolean;
    simplify_difficult_concepts?: boolean;
    external_knowledge?: boolean;
    answer_format?: string;
    version: number 
  }) {
    return this.request<{ 
      theme: string; 
      accent_color: string; 
      response_length: string;
      explanation_level: string;
      not_in_docs_behavior: string;
      citation_style: string;
      default_search_scope: string;
      follow_up_suggestions: boolean;
      simplify_difficult_concepts: boolean;
      external_knowledge: boolean;
      answer_format: string;
      version: number 
    }>(
      '/users/me/preferences',
      { method: 'PATCH', body: JSON.stringify(data) }
    );
  }

  // ── Avatar ──
  uploadAvatar(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    return this.request<ReturnType<typeof this.getProfile> extends Promise<infer R> ? R : never>(
      '/users/me/avatar',
      { method: 'PUT', body: formData }
    );
  }

  deleteAvatar() {
    return this.request<ReturnType<typeof this.getProfile> extends Promise<infer R> ? R : never>(
      '/users/me/avatar',
      { method: 'DELETE' }
    );
  }

  getAvatarUrl() {
    return `${BASE}/users/me/avatar`;
  }

  // ── Security ──
  changePassword(data: { current_password: string; new_password: string }) {
    return this.request<void>('/users/me/password', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  revokeOtherSessions() {
    return this.request<void>('/users/me/sessions/revoke-others', {
      method: 'POST',
    });
  }

  // ── Comparisons ──
  getComparisons(chatId: string) {
    return this.request<{
      items: Array<{
        id: string;
        query: string;
        document_ids: string[];
        generated_comparison: any;
        created_at: string;
      }>;
    }>(`/chats/${chatId}/comparisons`);
  }

  createComparison(chatId: string, query: string, documentIds: string[]) {
    return this.request<{
      id: string;
      query: string;
      document_ids: string[];
      generated_comparison: any;
      created_at: string;
    }>(`/chats/${chatId}/compare`, {
      method: 'POST',
      body: JSON.stringify({ query, document_ids: documentIds }),
    });
  }

  // ── Admin Models ──
  getOllamaStatus() {
    return this.rawRequest<{
      connected: boolean;
      base_url: string;
      models: string[];
      active_model_available: boolean;
      active_model: string;
      error?: string;
    }>('/admin/models/ollama-status');
  }

  // ── Admin Audit & Security ──
  getAdminAuditLogs(limit = 100) {
    return this.request<{ items: any[] }>(`/admin/audit-logs?limit=${limit}`);
  }

  getAdminSessions() {
    return this.request<{ items: any[] }>('/admin/sessions');
  }

  deleteAdminSession(sessionId: string) {
    return this.request<void>(`/admin/sessions/${sessionId}`, { method: 'DELETE' });
  }

  getAdminFailedLogins(limit = 50) {
    return this.request<{ items: any[] }>(`/admin/failed-logins?limit=${limit}`);
  }

  // ── Notes ──
  createNote(chatId: string, body: {
    document_id?: string | null; page_number?: number | null;
    title?: string | null; selected_text?: string | null;
    user_note?: string | null; tag?: string | null;
  }) {
    return this.request<{ id: string; created_at: string }>(
      `/chats/${chatId}/notes`, { method: 'POST', body: JSON.stringify(body) }
    );
  }

  getNotes(chatId: string) {
    return this.request<{ items: NoteItem[] }>(`/chats/${chatId}/notes`);
  }

  updateNote(chatId: string, noteId: string, body: {
    title?: string | null; user_note?: string | null;
    selected_text?: string | null; tag?: string | null;
    is_pinned?: boolean;
  }) {
    return this.request<{ status: string }>(
      `/chats/${chatId}/notes/${noteId}`,
      { method: 'PATCH', body: JSON.stringify(body) }
    );
  }

  deleteNote(chatId: string, noteId: string) {
    return this.request<{ status: string }>(
      `/chats/${chatId}/notes/${noteId}`, { method: 'DELETE' }
    );
  }

  noteAiAction(chatId: string, noteId: string, action: string, context?: string) {
    return this.request<{ type: string; action?: string; content?: string; target?: string; topic?: string; prompt?: string }>(
      `/chats/${chatId}/notes/${noteId}/ai`,
      { method: 'POST', body: JSON.stringify({ action, context }) }
    );
  }

  exportNotesMarkdown(chatId: string) {
    const token = localStorage.getItem('auth_token');
    return fetch(`/api/v1/chats/${chatId}/notes/export`, {
      headers: token ? { 'Authorization': `Bearer ${token}` } : undefined,
    });
  }

  // ── User Storage & Data ──
  getUserStorage() {
    return this.request<{
      quota_bytes: number;
      total_used_bytes: number;
      pdf_bytes: number;
      vector_bytes: number;
      chat_bytes: number;
      study_bytes: number;
      doc_count: number;
      indexed_doc_count: number;
      chat_count: number;
      flashcard_count: number;
      quiz_count: number;
      chunk_count: number;
    }>('/users/me/storage');
  }

  clearChatHistory() {
    return this.request<void>('/users/me/chats', { method: 'DELETE' });
  }

  resetStudyData() {
    return this.request<void>('/users/me/study-data', { method: 'DELETE' });
  }

  exportMyData() {
    const token = localStorage.getItem('auth_token');
    return fetch('/api/v1/users/me/export', {
      headers: token ? { 'Authorization': `Bearer ${token}` } : undefined,
    });
  }

  deleteMyAccount(confirm_password: string) {
    return this.request<void>('/users/me/account', {
      method: 'DELETE',
      body: JSON.stringify({ confirm_password }),
    });
  }

  rebuildVectorIndex() {
    return this.request<{ status: string }>('/users/me/rebuild-index', {
      method: 'POST'
    });
  }
}

export interface NoteItem {
  id: string;
  document_id: string | null;
  page_number: number | null;
  title: string | null;
  selected_text: string | null;
  user_note: string | null;
  tag: string | null;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
}

export interface AdminDocumentDetailData {
  id: string;
  original_filename: string;
  owner_username: string;
  owner_id: string;
  chat_id: string;
  chat_title: string;
  byte_size: number;
  page_count: number | null;
  status: string;
  error_code: string | null;
  ocr_page_count: number;
  chunk_count: number;
  index_version: string | null;
  extraction_version: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  latest_job_error: string | null;
}

export const api = new ApiClient();
