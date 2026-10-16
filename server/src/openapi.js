export const openapiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'KarabakhAgroInvest API',
    version: '1.0.0',
    description:
      'Qarabağ və Şərqi Zəngəzur üçün investisiya müsabiqəsi portalının REST API-si. ' +
      'EKTİS mərkəzi e-sistemləri ilə inteqrasiya (mock) daxildir.'
  },
  servers: [{ url: 'http://localhost:4000', description: 'Local development' }],
  tags: [
    { name: 'Auth', description: 'VÖEN/FİN əsaslı autentifikasiya (JWT)' },
    { name: 'Lands', description: 'Torpaq sahələri və xəritə məlumatları' },
    { name: 'Competitions', description: 'İnvestisiya müsabiqələri' },
    { name: 'Advisor', description: 'AI Ağıllı Məsləhətçi (məhsul tövsiyəsi)' },
    { name: 'Applications', description: 'İnvestisiya müraciətləri və izləmə' },
    { name: 'Notifications', description: 'İstifadəçi bildirişləri' },
    { name: 'ROI', description: 'Aqro-investisiya simulyatoru' },
    { name: 'Analytics', description: 'Portal analitikası və KPI' },
    { name: 'EKTİS', description: 'Dövlət mərkəzi sistemləri ilə inteqrasiya (mock)' }
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }
    }
  },
  security: [{ bearerAuth: [] }],
  paths: {
    '/api/v1/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'VÖEN/FİN və şifrə ilə giriş',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: { voen: { type: 'string' }, password: { type: 'string' } }
              },
              example: { voen: '1234567890', password: 'demo123' }
            }
          }
        },
        responses: { 200: { description: 'JWT token və istifadəçi' }, 401: { description: 'Yanlış məlumat' } }
      }
    },
    '/api/v1/auth/demo-accounts': {
      get: { tags: ['Auth'], summary: 'Demo hesablar (münsiflər üçün)', security: [], responses: { 200: { description: 'Hesab siyahısı' } } }
    },
    '/api/v1/lands': {
      get: {
        tags: ['Lands'],
        summary: 'Torpaq sahələrinin siyahısı',
        security: [],
        parameters: [
          { name: 'district', in: 'query', schema: { type: 'string' } },
          { name: 'purpose', in: 'query', schema: { type: 'string' } },
          { name: 'status', in: 'query', schema: { type: 'string' } }
        ],
        responses: { 200: { description: 'Sahə siyahısı' } }
      },
      post: { tags: ['Lands'], summary: 'Yeni torpaq sahəsi (admin)', responses: { 201: { description: 'Yaradıldı' } } }
    },
    '/api/v1/lands/stats': {
      get: { tags: ['Lands'], summary: 'Statistika', security: [], responses: { 200: { description: 'Statistika' } } }
    },
    '/api/v1/lands/{id}': {
      get: {
        tags: ['Lands'],
        summary: 'Sahə detalları',
        security: [],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Sahə' }, 404: { description: 'Tapılmadı' } }
      },
      put: {
        tags: ['Lands'],
        summary: 'Torpaq sahəsini redaktə et (admin)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  code: { type: 'string' },
                  district: { type: 'string' },
                  purpose: { type: 'string' },
                  areaHa: { type: 'number' },
                  ph: { type: 'number' },
                  fertility: { type: 'number' },
                  waterKm: { type: 'number' },
                  sunDays: { type: 'number' },
                  status: { type: 'string', enum: ['available', 'reserved', 'allocated'] }
                }
              },
              example: { areaHa: 55, status: 'reserved' }
            }
          }
        },
        responses: { 200: { description: 'Yenilənmiş sahə' }, 400: { description: 'Yanlış məlumat' }, 404: { description: 'Tapılmadı' } }
      }
    },
    '/api/v1/applications': {
      get: { tags: ['Applications'], summary: 'Müraciətlərin siyahısı (rola görə)', responses: { 200: { description: 'Siyahı' } } },
      post: {
        tags: ['Applications'],
        summary: 'Yeni müraciət yarat (layihə texnologiyaları, dəyər zənciri və göstəricilərlə)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['landId'],
                properties: {
                  landId: { type: 'string' },
                  purpose: { type: 'string' },
                  areaHa: { type: 'number' },
                  company: { type: 'string' },
                  investmentAmount: { type: 'number' },
                  businessPlan: { type: 'string' },
                  files: { type: 'array', items: { type: 'object' } },
                  technologies: {
                    type: 'array',
                    description: 'Müasir texnologiyalar',
                    items: { type: 'string', enum: ['smart_irrigation', 'precision_farming', 'green_energy'] }
                  },
                  valueChain: {
                    type: 'array',
                    description: 'Dəyər zənciri mərhələləri',
                    items: { type: 'string', enum: ['cultivation', 'harvest_storage', 'processing', 'sales_export'] }
                  },
                  arableAreaHa: { type: 'number', description: 'Ümumi əkin və bağ sahələri (ha)' },
                  permanentJobs: { type: 'integer', description: 'Yaradılan daimi iş yerləri' },
                  seasonalJobs: { type: 'integer', description: 'Yaradılan mövsümi iş yerləri' },
                  annualOutputTons: { type: 'number', description: 'İllik ümumi məhsul həcmi (ton)' }
                }
              },
              example: {
                landId: 'land-id',
                purpose: 'pambiq',
                areaHa: 50,
                technologies: ['smart_irrigation', 'precision_farming'],
                valueChain: ['cultivation', 'harvest_storage', 'processing'],
                arableAreaHa: 50,
                permanentJobs: 12,
                seasonalJobs: 30,
                annualOutputTons: 240
              }
            }
          }
        },
        responses: { 201: { description: 'Yaradıldı' }, 400: { description: 'Yanlış məlumat' } }
      }
    },
    '/api/v1/applications/track/{code}': {
      get: {
        tags: ['Applications'],
        summary: 'Müraciəti kodla izlə (ictimai)',
        security: [],
        parameters: [{ name: 'code', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Müraciət' }, 404: { description: 'Tapılmadı' } }
      }
    },
    '/api/v1/applications/{id}/status': {
      patch: { tags: ['Applications'], summary: 'Statusu dəyiş (operator/admin)', responses: { 200: { description: 'Yeniləndi' } } }
    },
    '/api/v1/roi/simulate': {
      post: {
        tags: ['ROI'],
        summary: 'İnvestisiya ROI simulyasiyası',
        security: [],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: { purpose: { type: 'string' }, areaHa: { type: 'number' } }
              },
              example: { purpose: 'pambiq', areaHa: 50 }
            }
          }
        },
        responses: { 200: { description: 'ROI nəticəsi' } }
      }
    },
    '/api/v1/ektis/lands': {
      get: { tags: ['EKTİS'], summary: 'EKTİS-dən kadastr məlumatı çək', security: [], responses: { 200: { description: 'Kadastr siyahısı' } } }
    },
    '/api/v1/ektis/applications/sync': {
      post: { tags: ['EKTİS'], summary: 'Müraciəti EKTİS mərkəzi sisteminə sinxronlaşdır', security: [], responses: { 200: { description: 'Sinxron nəticəsi' } } }
    },
    '/api/v1/ektis/farmer/verify/{voen}': {
      get: {
        tags: ['EKTİS'],
        summary: 'VÖEN ilə fermer statusunu yoxla',
        security: [],
        parameters: [{ name: 'voen', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Yoxlama nəticəsi' } }
      }
    },
    '/api/v1/ektis/status': {
      get: { tags: ['EKTİS'], summary: 'İnteqrasiya statusu', security: [], responses: { 200: { description: 'Status' } } }
    },
    '/api/v1/ektis/ndvi/{landId}': {
      get: {
        tags: ['EKTİS'],
        summary: 'Peyk NDVI monitorinqi (Sentinel-2 mock)',
        security: [],
        parameters: [{ name: 'landId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'NDVI zaman seriyası' } }
      }
    },
    '/api/v1/competitions': {
      get: { tags: ['Competitions'], summary: 'Müsabiqələrin siyahısı', security: [], responses: { 200: { description: 'Siyahı' } } },
      post: {
        tags: ['Competitions'],
        summary: 'Yeni müsabiqə yarat (admin)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['title', 'startDate', 'endDate'],
                properties: {
                  code: { type: 'string' },
                  title: { type: 'string' },
                  short: { type: 'string' },
                  description: { type: 'string' },
                  status: { type: 'string', enum: ['upcoming', 'active', 'closed'] },
                  startDate: { type: 'string', format: 'date' },
                  endDate: { type: 'string', format: 'date' },
                  totalBudget: { type: 'number' },
                  currency: { type: 'string' },
                  categories: { type: 'array', items: { type: 'string' } },
                  incentives: { type: 'array', items: { type: 'string' } },
                  eligibility: { type: 'array', items: { type: 'string' } },
                  stages: { type: 'array', items: { type: 'string' } }
                }
              },
              example: {
                title: 'Aqrar İnvestisiya Müsabiqəsi 2026',
                startDate: '2026-01-01',
                endDate: '2026-12-31',
                totalBudget: 1000000,
                categories: ['pambiq', 'uzum'],
                status: 'active'
              }
            }
          }
        },
        responses: { 201: { description: 'Yaradıldı' }, 400: { description: 'Yanlış məlumat' }, 403: { description: 'İcazə yoxdur' } }
      }
    },
    '/api/v1/competitions/{id}': {
      put: {
        tags: ['Competitions'],
        summary: 'Müsabiqəni tam yenilə (admin)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Yenilənmiş müsabiqə' }, 400: { description: 'Yanlış məlumat' }, 404: { description: 'Tapılmadı' } }
      },
      get: {
        tags: ['Competitions'],
        summary: 'Müsabiqə detalları',
        security: [],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Müsabiqə' }, 404: { description: 'Tapılmadı' } }
      }
    },
    '/api/v1/competitions/{id}/status': {
      patch: {
        tags: ['Competitions'],
        summary: 'Təsdiq mexanizmi: müsabiqə statusunu dəyiş (operator/admin)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          content: {
            'application/json': {
              schema: { type: 'object', properties: { status: { type: 'string', enum: ['upcoming', 'active', 'closed'] } } },
              example: { status: 'active' }
            }
          }
        },
        responses: { 200: { description: 'Yenilənmiş müsabiqə' }, 400: { description: 'Yanlış status' }, 404: { description: 'Tapılmadı' } }
      }
    },
    '/api/v1/competitions/{id}/stage': {
      patch: {
        tags: ['Competitions'],
        summary: 'Cari mərhələni əl ilə təyin et (operator/admin)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          content: {
            'application/json': {
              schema: { type: 'object', properties: { currentStage: { type: 'integer', nullable: true, description: '0-dan başlayan mərhələ indeksi; null = avtomatik (tarixə görə)' } } },
              example: { currentStage: 2 }
            }
          }
        },
        responses: { 200: { description: 'Yenilənmiş müsabiqə' }, 400: { description: 'Yanlış mərhələ indeksi' }, 404: { description: 'Tapılmadı' } }
      }
    },
    '/api/v1/notifications': {
      get: { tags: ['Notifications'], summary: 'İstifadəçinin bildirişləri (oxunmamış sayı ilə)', responses: { 200: { description: '{ unread, items }' } } }
    },
    '/api/v1/notifications/{id}/read': {
      patch: {
        tags: ['Notifications'],
        summary: 'Bildirişi oxundu kimi işarələ',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'OK' } }
      }
    },
    '/api/v1/notifications/read-all': {
      post: { tags: ['Notifications'], summary: 'Bütün bildirişləri oxundu kimi işarələ', responses: { 200: { description: 'OK' } } }
    },
    '/api/v1/competitions/active': {
      get: { tags: ['Competitions'], summary: 'Aktiv müsabiqə', security: [], responses: { 200: { description: 'Aktiv müsabiqə' } } }
    },
    '/api/v1/advisor/recommend': {
      post: {
        tags: ['Advisor'],
        summary: 'Sahə üçün ən uyğun məhsulların AI tövsiyəsi',
        security: [],
        requestBody: {
          content: {
            'application/json': {
              schema: { type: 'object', properties: { landId: { type: 'string' } } },
              example: { landId: 'land-id' }
            }
          }
        },
        responses: { 200: { description: 'Reytinqli tövsiyələr' } }
      }
    },
    '/api/v1/analytics/overview': {
      get: { tags: ['Analytics'], summary: 'Portal üzrə analitika və KPI', security: [], responses: { 200: { description: 'Analitika' } } }
    }
  }
};
