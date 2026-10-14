import { Request, Response } from 'express';
import { SupportService } from './support.service';
import { FAQ, Review } from './support.interface';
import { usersCollection } from '../../db/db';
import { uploadToCloudinary } from '../../utils/upload';

// ─── FAQS CONTROLLERS ────────────────────────────────────────────────────────

export const getFAQs = async (req: Request, res: Response) => {
  try {
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
  } catch {
    res.status(500).send({ success: false, message: 'Failed to fetch FAQs' });
  }
};

export const voteFAQHelpful = async (req: Request, res: Response) => {
  try {
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
  } catch {
    res.status(500).send({ success: false, message: 'Failed to process feedback' });
  }
};

export const getFAQCategories = async (_req: Request, res: Response) => {
  try {
    const categories = await SupportService.getFAQCategories();
    res.send({ success: true, data: categories });
  } catch {
    res.status(500).send({ success: false, message: 'Failed to fetch categories' });
  }
};

export const getAllFAQsAdmin = async (_req: Request, res: Response) => {
  try {
    const faqs = await SupportService.getAllFAQsAdmin();
    res.send({ success: true, data: faqs });
  } catch {
    res.status(500).send({ success: false, message: 'Failed to fetch FAQs' });
  }
};

export const createFAQ = async (req: Request, res: Response) => {
  try {
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
      (result as { _id?: unknown; insertedId?: unknown }).insertedId;
    res.status(201).send({
      success: true,
      data: { ...newFAQ, _id: createdId },
    });
  } catch {
    res.status(500).send({ success: false, message: 'Failed to create FAQ' });
  }
};

export const updateFAQ = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    delete updates._id;

    const result = await SupportService.updateFAQ(id as string, updates);
    if (result.matchedCount === 0) {
      return res.status(404).send({ success: false, message: 'FAQ not found' });
    }
    res.send({ success: true, message: 'FAQ updated successfully' });
  } catch {
    res.status(500).send({ success: false, message: 'Failed to update FAQ' });
  }
};

export const deleteFAQ = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await SupportService.deleteFAQ(id as string);
    if (result.deletedCount === 0) {
      return res.status(404).send({ success: false, message: 'FAQ not found' });
    }
    res.send({ success: true, message: 'FAQ deleted successfully' });
  } catch {
    res.status(500).send({ success: false, message: 'Failed to delete FAQ' });
  }
};

// ─── REVIEWS CONTROLLERS ─────────────────────────────────────────────────────

export const getRiderReviews = async (req: Request, res: Response) => {
  const { email } = req.params;
  try {
    const reviews = await SupportService.getRiderReviews(email as string);
    res.send(reviews);
  } catch {
    res.status(500).send({ error: 'Failed to fetch reviews' });
  }
};

export const submitReview = async (req: Request, res: Response) => {
  const review = req.body as Review;
  review.date = new Date().toISOString();
  try {
    const result = await SupportService.submitReview(review);
    res.send({ success: true, data: result });
  } catch {
    res.status(500).send({ error: 'Failed to submit review' });
  }
};

// ─── FEEDBACK CONTROLLERS ────────────────────────────────────────────────────

export const submitFeedback = async (req: Request, res: Response) => {
  try {
    const feedback = {
      ...req.body,
      userEmail: req.user?.email as string,
      timestamp: new Date().toISOString(),
      isResolved: false,
    };

    const result = await SupportService.submitFeedback(feedback);
    const insertedId =
      (result as { _id?: unknown; insertedId?: unknown })._id ||
      (result as { _id?: unknown; insertedId?: unknown }).insertedId;
    res.status(201).send({ success: true, insertedId });
  } catch {
    res.status(500).send({ success: false, message: 'Failed to submit feedback' });
  }
};

export const submitContactMessage = async (req: Request, res: Response) => {
  try {
    const { name, email, subject, message } = req.body;
    if (!name || !email || !message) {
      return res
        .status(400)
        .send({ success: false, message: 'Name, email and message are required' });
    }
    const result = await SupportService.submitContactMessage({ name, email, subject, message });
    const insertedId =
      (result as { _id?: unknown; insertedId?: unknown })._id ||
      (result as { _id?: unknown; insertedId?: unknown }).insertedId;
    res.status(201).send({ success: true, insertedId });
  } catch {
    res.status(500).send({ success: false, message: 'Failed to send message' });
  }
};

export const getAllFeedback = async (_req: Request, res: Response) => {
  try {
    const feedback = await SupportService.getAllFeedback();
    res.send({ success: true, data: feedback });
  } catch {
    res.status(500).send({ success: false, message: 'Failed to fetch feedback' });
  }
};

// ─── NOTIFICATIONS CONTROLLERS ───────────────────────────────────────────────

export const getUnreadNotifications = async (req: Request, res: Response) => {
  const { email } = req.params;
  if (req.user?.email !== email)
    return res.status(403).send({ success: false, message: 'Unauthorized' });
  try {
    const notifications = await SupportService.getUnreadNotifications(email as string);
    res.send(notifications);
  } catch {
    res.status(500).send({ error: 'Failed to fetch notifications' });
  }
};

export const markNotificationRead = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const result = await SupportService.markNotificationRead(id as string);
    res.send(result);
  } catch {
    res.status(500).send({ error: 'Failed to mark as read' });
  }
};

export const markAllNotificationsRead = async (req: Request, res: Response) => {
  const { email } = req.params;
  if (req.user?.email !== email)
    return res.status(403).send({ success: false, message: 'Unauthorized' });
  try {
    const result = await SupportService.markAllNotificationsRead(email as string);
    res.send(result);
  } catch {
    res.status(500).send({ error: 'Failed to mark all as read' });
  }
};

// ─── MESSAGES/CHAT CONTROLLERS ───────────────────────────────────────────────

export const getChatHistory = async (req: Request, res: Response) => {
  try {
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
  } catch {
    res.status(500).send({ success: false, message: 'Failed to fetch messages' });
  }
};

import * as fs from 'fs';
import * as path from 'path';

const logDebug = (msg: string) => {
  try {
    console.log(`[DEBUG] ${msg}`);
    fs.appendFileSync(
      path.join(__dirname, '../../../debug.log'),
      `[${new Date().toISOString()}] ${msg}\n`,
    );
  } catch {
    // Ignore logging errors
  }
};

export const getUserConversations = async (req: Request, res: Response) => {
  try {
    const userEmail = req.user?.email as string;
    const user = await usersCollection.findOne({ email: userEmail });
    const isAdmin = user?.role === 'admin' || user?.role === 'superAdmin';
    const queryEmail = isAdmin ? 'admin@gram2city.com' : userEmail;

    logDebug(
      `getUserConversations: userEmail=${userEmail}, role=${user?.role}, queryEmail=${queryEmail}`,
    );

    const conversations = await SupportService.getUserConversations(queryEmail);

    logDebug(`getUserConversations results count: ${conversations.length}`);

    res.send({ success: true, data: conversations });
  } catch (error: unknown) {
    const err = error as Error;
    logDebug(`getUserConversations ERROR: ${err?.message || String(error)}`);
    res.status(500).send({ success: false, message: 'Failed to fetch conversations' });
  }
};

// ─── CHAT IMAGE UPLOAD ───────────────────────────────────────────────────────

export const uploadChatImage = async (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).send({
      success: false,
      message: 'No file uploaded or file type not supported',
    });
  }

  try {
    const url = await uploadToCloudinary(req.file, 'gram2city/chat');
    res.send({ success: true, url });
  } catch {
    res.status(500).send({ success: false, message: 'Failed to upload image' });
  }
};
