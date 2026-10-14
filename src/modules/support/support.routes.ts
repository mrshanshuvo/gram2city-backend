import { Router } from 'express';
import multer from 'multer';
import {
  getFAQs,
  voteFAQHelpful,
  getFAQCategories,
  getAllFAQsAdmin,
  createFAQ,
  updateFAQ,
  deleteFAQ,
  getRiderReviews,
  submitReview,
  submitFeedback,
  submitContactMessage,
  getAllFeedback,
  getUnreadNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getChatHistory,
  getUserConversations,
  uploadChatImage,
} from './support.controller';
import { verifyAuthToken, verifyAdmin } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { reviewSchema, feedbackSchema } from './support.schema';

const router = Router();

// Multer for chat image uploads
const chatUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, and WebP images are allowed'));
    }
  },
});

// Contact Route
router.post('/contact', submitContactMessage);

// FAQ Routes

router.get('/faqs', getFAQs);
router.patch('/faqs/:id/helpful', voteFAQHelpful);
router.get('/faqs/categories', getFAQCategories);
router.get('/faqs/admin', verifyAuthToken, verifyAdmin, getAllFAQsAdmin);
router.post('/faqs', verifyAuthToken, verifyAdmin, createFAQ);
router.patch('/faqs/:id', verifyAuthToken, verifyAdmin, updateFAQ);
router.delete('/faqs/:id', verifyAuthToken, verifyAdmin, deleteFAQ);

// Review Routes
router.get('/reviews/rider/:email', getRiderReviews);
router.post('/reviews', verifyAuthToken, validate(reviewSchema), submitReview);

// Feedback Routes
router.post('/feedback', verifyAuthToken, validate(feedbackSchema), submitFeedback);
router.get('/feedback', verifyAuthToken, verifyAdmin, getAllFeedback);

// Notification Routes
router.get('/notifications/:email', verifyAuthToken, getUnreadNotifications);
router.patch('/notifications/:id/read', verifyAuthToken, markNotificationRead);
router.patch('/notifications/read-all/:email', verifyAuthToken, markAllNotificationsRead);

// Messaging Routes
router.get('/messages/conversations', verifyAuthToken, getUserConversations);
router.get('/messages/:conversationId', verifyAuthToken, getChatHistory);
router.post('/messages/upload-image', verifyAuthToken, chatUpload.single('image'), uploadChatImage);

export default router;
