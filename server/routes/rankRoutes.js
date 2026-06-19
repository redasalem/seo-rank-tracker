import express from 'express';
import auth from '../middleware/auth.js';
import { validate, addKeywordSchema, mongoIdSchema } from '../middleware/validations.js';
import { 
    addKeyword, 
    getKeywords, 
    getDashboardStats,
    getKeyword, 
    refreshKeyword, 
    deleteKeyword, 
    toggleTracking,
    getGlobalCompetitors
} from '../controllers/rankControllers.js';

const rankRouter = express.Router();

// حماية جميع المسارات الخاصة بالرتب حتى لا يتمكن سوى المستخدمين المسجلين من الوصول إليها
rankRouter.use(auth);

// مسارات إدارة الكلمات المفتاحية
rankRouter.post('/add', validate(addKeywordSchema), addKeyword);             // إضافة كلمة جديدة
rankRouter.get('/stats', getDashboardStats);     // جلب إحصائيات لوحة التحكم
rankRouter.get('/competitors', getGlobalCompetitors); // جلب جميع المنافسين المتقاطعين
rankRouter.get('/', getKeywords);                // جلب كل الكلمات مع Pagination
rankRouter.get('/:id', validate(mongoIdSchema, "params"), getKeyword);              // جلب تفاصيل كلمة واحدة
rankRouter.delete('/:id', validate(mongoIdSchema, "params"), deleteKeyword);        // حذف كلمة

// مسارات تنفيذ إجراءات محددة
rankRouter.post('/:id/refresh', validate(mongoIdSchema, "params"), refreshKeyword); // تحديث الترتيب يدوياً
rankRouter.put('/:id/toggle', validate(mongoIdSchema, "params"), toggleTracking);   // إيقاف أو تفعيل التتبع

export default rankRouter;
