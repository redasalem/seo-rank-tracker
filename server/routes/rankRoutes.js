import express from 'express';
import auth from '../middleware/auth.js';
import { 
    addKeyword, 
    getKeywords, 
    getKeyword, 
    refreshKeyword, 
    deleteKeyword, 
    toggleTracking 
} from '../controllers/rankControllers.js';

const rankRouter = express.Router();

// حماية جميع المسارات الخاصة بالرتب حتى لا يتمكن سوى المستخدمين المسجلين من الوصول إليها
rankRouter.use(auth);

// مسارات إدارة الكلمات المفتاحية
rankRouter.post('/add', addKeyword);             // إضافة كلمة جديدة
rankRouter.get('/', getKeywords);                // جلب كل الكلمات
rankRouter.get('/:id', getKeyword);              // جلب تفاصيل كلمة واحدة
rankRouter.delete('/:id', deleteKeyword);        // حذف كلمة

// مسارات تنفيذ إجراءات محددة
rankRouter.post('/:id/refresh', refreshKeyword); // تحديث الترتيب يدوياً
rankRouter.put('/:id/toggle', toggleTracking);   // إيقاف أو تفعيل التتبع

export default rankRouter;
