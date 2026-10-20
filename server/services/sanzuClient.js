/**
 * Cliente centralizado para la API de Sanzu (SB-01 / Contrato Haitani ↔ Sanzu v1)
 * Gestiona autenticación por X-Api-Key, timeouts, reintentos seguros,
 * cancelación mediante AbortController, y registro seguro sin filtración de secretos.
 */

const DEFAULT_BASE_URL = 'https://sanzu.onrender.com';
const API_PREFIX = '/api/v1';
const DEFAULT_TIMEOUT_MS = Number(process.env.SANZU_TIMEOUT_MS || 8000);

/**
 * Sanitiza valores y cadenas de texto para evitar fugas de secretos en logs y mensajes
 */
function sanitize(input) {
  if (typeof input !== 'string') return String(input || '');
  return input
    .replace(/(sz_live_[A-Za-z0-9_-]+)/g, 'sz_live_••••••••')
    .replace(/(Bearer\s+)[A-Za-z0-9_.-]+/gi, '$1••••••••')
    .replace(/(password|secret|token)=[^&\s]+/gi, '$1=••••••••');
}

/**
 * Formatea y enmascara claves API para visualización segura
 */
function maskApiKey(key) {
  if (!key) return '';
  const str = String(key).trim();
  if (str.length <= 8) return '••••••••';
  return `${str.slice(0, 4)}...${str.slice(-4)}`;
}

/**
 * Normaliza la URL base de Sanzu
 */
function resolveBaseUrl(customUrl) {
  const url = customUrl || process.env.SANZU_API_URL || DEFAULT_BASE_URL;
  return String(url).trim().replace(/\/+$/, '');
}

/**
 * Clase principal del cliente Sanzu
 */
class SanzuClient {
  constructor(options = {}) {
    this.baseUrl = resolveBaseUrl(options.apiUrl);
    this.apiKey = options.apiKey || process.env.SANZU_API_KEY || null;
    this.timeoutMs = Number(options.timeoutMs || DEFAULT_TIMEOUT_MS);
    this.retries = Number(options.retries ?? 2);
  }

  /**
   * Ejecuta peticiones HTTP con control de tiempo, reintentos y sanitización
   */
  async request(path, options = {}) {
    const targetUrl = `${resolveBaseUrl(options.apiUrl || this.baseUrl)}${path}`;
    const effectiveApiKey = options.apiKey || this.apiKey || process.env.SANZU_API_KEY;
    const timeout = Number(options.timeoutMs || this.timeoutMs);
    const maxRetries = options.retries !== undefined ? Number(options.retries) : this.retries;

    const headers = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };

    if (effectiveApiKey) {
      headers['X-Api-Key'] = effectiveApiKey;
    }

    let attempt = 0;
    let lastError = null;

    while (attempt <= maxRetries) {
      attempt++;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);

      try {
        const response = await fetch(targetUrl, {
          ...options,
          headers,
          signal: controller.signal
        });

        clearTimeout(timer);

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          const rawMessage = data?.error?.message || data?.message || `Sanzu respondió con código ${response.status}`;
          const cleanMessage = sanitize(rawMessage);
          const error = new Error(cleanMessage);
          error.status = response.status;
          error.code = data?.error?.code || `HTTP_${response.status}`;
          error.details = data?.error?.details;

          // No reintentar errores de cliente (4xx), excepto 408 (timeout) y 429 (rate limit)
          if (response.status >= 400 && response.status < 500 && ![408, 429].includes(response.status)) {
            throw error;
          }

          lastError = error;
          if (attempt <= maxRetries) {
            const backoffMs = Math.min(1500, 300 * Math.pow(2, attempt - 1));
            await new Promise(res => setTimeout(res, backoffMs));
            continue;
          }
          throw error;
        }

        return data;
      } catch (cause) {
        clearTimeout(timer);

        // Si ya es un error HTTP con código de estado, propagar directamente
        if (cause.status) {
          throw cause;
        }


        const isTimeout = cause.name === 'AbortError';
        const msg = isTimeout
          ? `Sanzu no respondió dentro del tiempo límite de ${timeout} ms.`
          : `No fue posible conectar con el servicio Sanzu: ${sanitize(cause.message || cause)}`;

        const error = new Error(msg);
        error.code = isTimeout ? 'TIMEOUT_ERROR' : 'NETWORK_ERROR';
        error.status = isTimeout ? 504 : 503;
        lastError = error;

        if (attempt <= maxRetries) {
          const backoffMs = Math.min(1500, 300 * Math.pow(2, attempt - 1));
          await new Promise(res => setTimeout(res, backoffMs));
          continue;
        }

        throw error;
      }
    }

    throw lastError;
  }

  /**
   * Comprueba disponibilidad y salud de Sanzu
   */
  async checkHealth(options = {}) {
    try {
      const data = await this.request(`${API_PREFIX}/health`, {
        method: 'GET',
        retries: 1,
        timeoutMs: options.timeoutMs || 4000,
        apiUrl: options.apiUrl
      });
      return {
        online: true,
        status: data?.data?.status || 'healthy',
        timestamp: data?.data?.timestamp || new Date().toISOString()
      };
    } catch (err) {
      return {
        online: false,
        status: 'unreachable',
        error: sanitize(err.message)
      };
    }
  }

  /**
   * Verifica validez de la API Key mediante endpoint partner
   */
  async testAuth(apiKey, apiUrl) {
    if (!apiKey || !String(apiKey).trim()) {
      throw new Error('La Sanzu API Key es obligatoria.');
    }
    const cleanKey = String(apiKey).trim();
    const cleanUrl = resolveBaseUrl(apiUrl || this.baseUrl);

    return this.request(`${API_PREFIX}/partner/projects`, {
      method: 'GET',
      apiKey: cleanKey,
      apiUrl: cleanUrl,
      retries: 1,
      timeoutMs: 5000
    });
  }

  /**
   * Envía pregunta al asistente inteligente de Sanzu
   */
  async askAssistant(message, context = {}, options = {}) {
    const payload = {
      message: String(message || '').trim(),
      externalRef: options.externalRef || (context.project?.id ? `haitani-proj-${context.project.id}` : 'haitani-default'),
      conversationId: options.conversationId,
      context: {
        companyId: context.companyId || context.organizationId,
        projectId: context.project?.id,
        project: context.project ? {
          name: context.project.name,
          methodology: context.project.methodology_id || context.project.methodology || 'SCRUM',
          status: context.project.status
        } : undefined,
        tasks: context.tasks,
        team: context.users || context.team,
        risks: context.risks,
        locale: context.locale || 'es-MX'
      }
    };

    const res = await this.request(`${API_PREFIX}/partner/chatbot/message`, {
      method: 'POST',
      body: JSON.stringify(payload),
      apiKey: options.apiKey || this.apiKey,
      apiUrl: options.apiUrl || this.baseUrl
    });

    return {
      success: true,
      answer: res.answer || res.response || res.data?.response || res.message,
      sources: res.sources || [],
      suggestions: res.suggestions || [],
      metadata: res.metadata || { provider: 'sanzu', version: 'v1' },
      data: res.data
    };
  }

  /**
   * Envía contexto completo de proyecto para análisis de salud, riesgos y recomendaciones
   */
  async analyzeProject(externalRef, payload, options = {}) {
    const path = `${API_PREFIX}/projects/${encodeURIComponent(externalRef)}/context`;
    return (await this.request(path, {
      method: 'POST',
      body: JSON.stringify(payload),
      apiKey: options.apiKey || this.apiKey,
      apiUrl: options.apiUrl || this.baseUrl
    })).data;
  }

  /**
   * Sincroniza metadatos básicos de un proyecto en Sanzu
   */
  async syncProject(project, options = {}) {
    const payload = {
      externalRef: project.sanzu_external_ref || `haitani-proj-${project.id}`,
      name: project.name,
      description: project.description || undefined,
      methodologyId: project.methodology_id || 'SCRUM',
      requirements: project.requirements,
      status: project.status,
      priority: project.priority,
      budget: Number(project.budget || 0),
      startDate: project.start_date ? new Date(project.start_date).toISOString().slice(0, 10) : undefined,
      endDate: project.end_date ? new Date(project.end_date).toISOString().slice(0, 10) : undefined
    };

    return (await this.request(`${API_PREFIX}/partner/projects`, {
      method: 'POST',
      body: JSON.stringify(payload),
      apiKey: options.apiKey || this.apiKey,
      apiUrl: options.apiUrl || this.baseUrl
    })).data;
  }

  /**
   * Consulta el diccionario especializado de Sanzu
   */
  async searchDictionary(params = {}, options = {}) {
    const query = new URLSearchParams();
    if (params.q) query.set('q', params.q);
    if (params.category) query.set('category', params.category);
    if (params.mode) query.set('mode', params.mode);
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));

    const path = `${API_PREFIX}/dictionary${query.toString() ? `?${query}` : ''}`;
    return (await this.request(path, {
      method: 'GET',
      apiUrl: options.apiUrl || this.baseUrl
    })).data;
  }

  /**
   * Consulta un término específico del diccionario de Sanzu
   */
  async getDictionaryTerm(term, options = {}) {
    const path = `${API_PREFIX}/dictionary/${encodeURIComponent(term)}`;
    return (await this.request(path, {
      method: 'GET',
      apiUrl: options.apiUrl || this.baseUrl
    })).data;
  }
}

// Instancia singleton por defecto
const defaultClient = new SanzuClient();

module.exports = {
  SanzuClient,
  defaultClient,
  sanitize,
  maskApiKey,
  resolveBaseUrl,
  API_PREFIX,
  DEFAULT_BASE_URL,
  DEFAULT_TIMEOUT_MS
};
