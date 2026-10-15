import { Request, Response } from 'express';
import { SupportService } from './support.service';
import { FAQ, Review } from './support.interface';
import { usersCollection } from '../../db/db';
import { uploadToCloudinary } from '../../utils/upload';
import { catchAsync } from '../../utils/catchAsync';

// ─── FAQS CONTROLLERS ────────────────────────────────────────────────────────

export const getFAQs = catchAsync(async (req: Request, res: Response) => {
  const { page = 1, limit = 10, category, sortBy = 'order' } = req.query;
  const { faqs, total } = await SupportService.getFAQs(
    Number(page),
    Number(limit),
    category as string,
    sortBy as string,
  );

  res.send({
    success: true,
    data: faqs,
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit)),
    },
  });
});

export const voteFAQHelpful = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  let identifier: string = req.ip || 'unknown';

  const authHeader = req.headers.authorization;
  if (authHeader) {
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (token) {
      try {
        const { verifyAccessToken } = await import('../../utils/jwt');
        const decoded = verifyAccessToken(token);
        if (decoded.email) identifier = decoded.email;
      } catch {
        // Fallback to IP
      }
    }
  }

  const result = await SupportService.voteFAQHelpful(id as string, identifier);
  if (!result.success) {
    return res.status(400).send(result);
  }
  res.send(result);
});

export const getFAQCategories = catchAsync(async (_req: Request, res: Response) => {
  const categories = await SupportService.getFAQCategories();
  res.send({ success: true, data: categories });
});

export const getAllFAQsAdmin = catchAsync(async (_req: Request, res: Response) => {
  const faqs = await SupportService.getAllFAQsAdmin();
  res.send({ success: true, data: faqs });
});

export const createFAQ = catchAsync(async (req: Request, res: Response) => {
  const { question, answer, order, category } = req.body;
  const newFAQ: FAQ = {
    question,
    answer,
    order: order ? Number(order) : 0,
    category: category || 'General',
    isActive: true,
    helpfulCount: 0,
    createdAt: new Date().toISOString(),
  };
  const result = await SupportService.createFAQ(newFAQ);
  const createdId =
    (result as { _id?: unknown; insertedId?: unknown })._id ||
    (result as { insertedId?: unknown }).insertedId;
  res.status(201).send({
    success: true,
    data: { ...newFAQ, _id: createdId },
  });
});

export const updateFAQ = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const updates = req.body;
  delete updates._id;

  const result = await SupportService.updateFAQ(id as string, updates);
  if (result.matchedCount === 0) {
    return res.status(404).send({ success: false, message: 'FAQ not found' });
  }
  res.send({ success: true, message: 'FAQ updated successfully' });
});

export const deleteFAQ = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await SupportService.deleteFAQ(id as string);
  if (result.deletedCount === 0) {
    return res.status(404).send({ success: false, message: 'FAQ not found' });
  }
  res.send({ success: true, message: 'FAQ deleted successfully' });
});

// ─── REVIEWS CONTROLLERS ─────────────────────────────────────────────────────

export const getRiderReviews = catchAsync(async (req: Request, res: Response) => {
  const { email } = req.params;
  const reviews = await SupportService.getRiderReviews(email as string);
  res.send(reviews);
});

export const submitReview = catchAsync(async (req: Request, res: Response) => {
  const review = req.body as Review;
  review.date = new Date().toISOString();
  const result = await SupportService.submitReview(review);
  res.send({ success: true, data: result });
});

// ─── FEEDBACK CONTROLLERS ────────────────────────────────────────────────────

export const submitFeedback = catchAsync(async (req: Request, res: Response) => {
  const feedback = {
    ...req.body,
    userEmail: req.user?.email as string,
    timestamp: new Date().toISOString(),
    isResolved: false,
  };

  const result = await SupportService.submitFeedback(feedback);
  const insertedId =
    (result as { _id?: unknown; insertedId?: unknown })._id ||
    (result as { insertedId?: unknown }).insertedId;
  res.status(201).send({ success: true, insertedId });
});

export const submitContactMessage = catchAsync(async (req: Request, res: Response) => {
  const { name, email, subject, message } = req.body;
  if (!name || !email || !message) {
    return res
      .status(400)
      .send({ success: false, message: 'Name, email and message are required' });
  }
  const result = await SupportService.submitContactMessage({ name, email, subject, message });
  const insertedId =
    (result as { _id?: unknown; insertedId?: unknown })._id ||
    (result as { insertedId?: unknown }).insertedId;
  res.status(201).send({ success: true, insertedId });
});

export const getAllFeedback = catchAsync(async (_req: Request, res: Response) => {
  const feedback = await SupportService.getAllFeedback();
  res.send({ success: true, data: feedback });
});

// ─── NOTIFICATIONS CONTROLLERS ───────────────────────────────────────────────

export const getUnreadNotifications = catchAsync(async (req: Request, res: Response) => {
  const { email } = req.params;
  if (req.user?.email !== email) {
    return res.status(403).send({ success: false, message: 'Unauthorized' });
  }
  const notifications = await SupportService.getUnreadNotifications(email as string);
  res.send(notifications);
});

export const markNotificationRead = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const result = await SupportService.markNotificationRead(id as string);
  res.send(result);
});

export const markAllNotificationsRead = catchAsync(async (req: Request, res: Response) => {
  const { email } = req.params;
  if (req.user?.email !== email) {
    return res.status(403).send({ success: false, message: 'Unauthorized' });
  }
  const result = await SupportService.markAllNotificationsRead(email as string);
  res.send(result);
});

// ─── MESSAGES/CHAT CONTROLLERS ───────────────────────────────────────────────

export const getChatHistory = catchAsync(async (req: Request, res: Response) => {
  const { conversationId } = req.params;
  const userEmail = req.user?.email as string;

  if (!conversationId.includes(userEmail)) {
    const user = await usersCollection.findOne({ email: userEmail });
    if (user?.role !== 'admin' && user?.role !== 'superAdmin') {
      return res.status(403).send({
        success: false,
        message: 'Unauthorized to view this conversation',
      });
    }
  }

  const messages = await SupportService.getChatHistory(conversationId as string);
  res.send({ success: true, data: messages });
});

export const getUserConversations = catchAsync(async (req: Request, res: Response) => {
  const userEmail = req.user?.email as string;
  const user = await usersCollection.findOne({ email: userEmail });
  const isAdmin = user?.role === 'admin' || user?.role === 'superAdmin';
  const queryEmail = isAdmin ? 'admin@gram2city.com' : userEmail;

  const conversations = await SupportService.getUserConversations(queryEmail);
  res.send({ success: true, data: conversations });
});

// ─── CHAT IMAGE UPLOAD ───────────────────────────────────────────────────────

export const uploadChatImage = catchAsync(async (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).send({
      success: false,
      message: 'No file uploaded or file type not supported',
    });
  }

  const url = await uploadToCloudinary(req.file, 'gram2city/chat');
  res.send({ success: true, url });
});
