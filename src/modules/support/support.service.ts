import { ObjectId } from 'mongodb';
import {
  FAQModel,
  FAQVoteModel,
  ReviewModel,
  FeedbackModel,
  NotificationModel,
  MessageModel,
} from '../../db/models';
import { FAQ, Review, Feedback, Notification, ChatMessage } from './support.interface';

export class SupportService {
  // FAQs
  static async getFAQs(page: number, limit: number, category?: string, sortBy: string = 'order') {
    const skip = (page - 1) * limit;
    const query: Record<string, unknown> = { isActive: true };
    if (category) query.category = category;

    const sortObj: Record<string, 1 | -1> = {};
    if (sortBy === 'helpful') {
      sortObj.helpfulCount = -1;
    } else {
      sortObj.order = 1;
      sortObj.createdAt = -1;
    }

    const faqs = (await FAQModel.find(query)
      .sort(sortObj)
      .skip(skip)
      .limit(limit)
      .lean()) as unknown as FAQ[];

    const total = await FAQModel.countDocuments(query);
    return { faqs, total };
  }

  static async voteFAQHelpful(faqId: string, identifier: string) {
    const existingVote = await FAQVoteModel.findOne({
      faqId: new ObjectId(faqId),
      identifier,
    }).lean();

    if (existingVote) {
      return {
        success: false,
        message: 'You have already voted for this question.',
      };
    }

    await FAQVoteModel.create({
      faqId: new ObjectId(faqId),
      identifier,
      timestamp: new Date().toISOString(),
    });

    const result = await FAQModel.updateOne(
      { _id: new ObjectId(faqId) },
      { $inc: { helpfulCount: 1 } },
    );

    if (result.matchedCount === 0) {
      return { success: false, message: 'FAQ not found' };
    }

    return { success: true, message: 'Thank you for your feedback!' };
  }

  static async getFAQCategories(): Promise<string[]> {
    return FAQModel.distinct('category', { isActive: true });
  }

  static async getAllFAQsAdmin(): Promise<FAQ[]> {
    return FAQModel.find().sort({ order: 1, createdAt: -1 }).lean() as unknown as FAQ[];
  }

  static async createFAQ(faq: Omit<FAQ, '_id'>) {
    return FAQModel.create(faq);
  }

  static async updateFAQ(faqId: string, updates: Partial<FAQ>) {
    return FAQModel.updateOne({ _id: new ObjectId(faqId) }, { $set: updates });
  }

  static async deleteFAQ(faqId: string) {
    return FAQModel.deleteOne({ _id: new ObjectId(faqId) });
  }

  // Reviews
  static async getRiderReviews(email: string): Promise<Review[]> {
    return ReviewModel.find({ rider_email: email })
      .sort({ date: -1 })
      .lean() as unknown as Review[];
  }

  static async submitReview(review: Review) {
    return ReviewModel.create(review);
  }

  // Feedback
  static async submitFeedback(feedback: Omit<Feedback, '_id'>) {
    return FeedbackModel.create(feedback);
  }

  static async submitContactMessage(data: {
    name: string;
    email: string;
    subject: string;
    message: string;
  }) {
    return FeedbackModel.create({
      ...data,
      type: 'contact_inquiry',
      timestamp: new Date().toISOString(),
    } as unknown as Feedback);
  }

  static async getAllFeedback(): Promise<Feedback[]> {
    return FeedbackModel.find().sort({ timestamp: -1 }).lean() as unknown as Feedback[];
  }

  // Notifications
  static async getUnreadNotifications(email: string): Promise<Notification[]> {
    return NotificationModel.find({ email, isRead: false })
      .sort({ time: -1 })
      .lean() as unknown as Notification[];
  }

  static async markNotificationRead(id: string) {
    return NotificationModel.updateOne({ _id: new ObjectId(id) }, { $set: { isRead: true } });
  }

  static async markAllNotificationsRead(email: string) {
    return NotificationModel.updateMany({ email, isRead: false }, { $set: { isRead: true } });
  }

  // Messages
  static async getChatHistory(conversationId: string): Promise<ChatMessage[]> {
    return MessageModel.find({ conversationId })
      .sort({ timestamp: 1 })
      .lean() as unknown as ChatMessage[];
  }

  static async getUserConversations(email: string): Promise<Record<string, unknown>[]> {
    return MessageModel.aggregate([
      {
        $match: {
          $or: [{ senderEmail: email }, { receiverEmail: email }],
        },
      },
      { $sort: { timestamp: -1 } },
      {
        $group: {
          _id: '$conversationId',
          lastMessage: { $first: '$$ROOT' },
          unreadCount: {
            $sum: {
              $cond: [
                {
                  $and: [{ $eq: ['$receiverEmail', email] }, { $eq: ['$isRead', false] }],
                },
                1,
                0,
              ],
            },
          },
        },
      },
      { $sort: { 'lastMessage.timestamp': -1 } },
    ]);
  }
}
