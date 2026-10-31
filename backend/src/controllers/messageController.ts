import { Response } from 'express';
import { AuthRequest } from '../types';
import { Conversation, Message } from '../models/Message';
import { Connection } from '../models/Connection';
import { sendSuccess, sendError } from '../utils/response';
import { AthleteProfile } from '../models/AthleteProfile';
import { CoachProfile } from '../models/CoachProfile';
import { Organization } from '../models/Organization';
import mongoose from 'mongoose';
import { safeHttpUrl, safeImageRef } from '../utils/security';

async function getParticipantProfile(userId: string, role: string) {
  if (role === 'athlete') {
    const p = await AthleteProfile.findOne({ userId }).select('fullName photo profileUrl').lean();
    if (p) return { fullName: p.fullName, photo: p.photo, profileUrl: p.profileUrl };
  } else if (role === 'coach' || role === 'professional') {
    const p = await CoachProfile.findOne({ userId }).select('fullName photo profileUrl').lean();
    if (p) return { fullName: p.fullName, photo: p.photo, profileUrl: p.profileUrl };
  } else if (role === 'organization') {
    const p = await Organization.findOne({ userId }).select('name logo profileUrl').lean();
    if (p) return { fullName: p.name, photo: p.logo, profileUrl: p.profileUrl };
  }
  return null;
}

export const getConversations = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const currentUserId = req.user!._id.toString();
    const conversations = await Conversation.find({ participants: req.user!._id })
      .populate('participants', 'email role')
      .populate('lastMessage')
      .sort({ lastMessageAt: -1 });

    const enriched = await Promise.all(
      conversations.map(async (conv) => {
        const obj = conv.toObject() as unknown as Record<string, unknown>;
        const other = (conv.participants as any[]).find(
          (p) => p._id.toString() !== currentUserId
        );
        if (other) {
          const profile = await getParticipantProfile(other._id.toString(), other.role);
          obj.otherUser = {
            _id: other._id,
            role: other.role,
            email: other.email,
            fullName: profile?.fullName || other.email,
            photo: profile?.photo || null,
            profileUrl: profile?.profileUrl || null,
          };
        }
        return obj;
      })
    );

    sendSuccess(res, enriched);
  } catch { sendError(res, 'Failed to get conversations', 500); }
};

export const getOrCreateConversation = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user!._id.toString();
    if (!mongoose.isValidObjectId(userId)) { sendError(res, 'User not found', 404); return; }

    const connected = await Connection.findOne({
      $or: [
        { requesterId: currentUserId, recipientId: userId, status: 'accepted' },
        { requesterId: userId, recipientId: currentUserId, status: 'accepted' },
      ],
    });

    if (!connected) { sendError(res, 'You must be connected to message', 403); return; }

    let conversation = await Conversation.findOne({
      participants: { $all: [currentUserId, userId], $size: 2 },
    }).populate('participants', 'email role').populate('lastMessage');

    if (!conversation) {
      conversation = await Conversation.create({ participants: [currentUserId, userId] });
      await conversation.populate('participants', 'email role');
    }

    const obj = conversation.toObject() as unknown as Record<string, unknown>;
    const other = (conversation.participants as any[]).find(
      (p) => p._id.toString() !== currentUserId
    );
    if (other) {
      const profile = await getParticipantProfile(other._id.toString(), other.role);
      obj.otherUser = {
        _id: other._id,
        role: other.role,
        email: other.email,
        fullName: profile?.fullName || other.email,
        photo: profile?.photo || null,
        profileUrl: profile?.profileUrl || null,
      };
    }

    sendSuccess(res, obj);
  } catch { sendError(res, 'Failed to get conversation', 500); }
};

export const getMessages = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { conversationId } = req.params;
    if (!mongoose.isValidObjectId(conversationId)) { sendError(res, 'Conversation not found', 404); return; }
    const page = Math.max(1, parseInt(String(req.query.page)) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit)) || 50));
    const skip = (page - 1) * limit;

    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: req.user!._id,
    });

    if (!conversation) { sendError(res, 'Conversation not found', 404); return; }

    const messages = await Message.find({
      conversationId,
      deletedBy: { $ne: req.user!._id },
    })
      .sort({ sentAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('senderId', 'email role');

    await Message.updateMany(
      { conversationId, senderId: { $ne: req.user!._id }, isRead: false },
      { isRead: true }
    );

    sendSuccess(res, messages.reverse());
  } catch { sendError(res, 'Failed to get messages', 500); }
};

export const sendMessage = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { conversationId } = req.params;
    if (!mongoose.isValidObjectId(conversationId)) { sendError(res, 'Conversation not found', 404); return; }
    const { messageType: rawType = 'text', attachmentUrl: rawUrl, attachmentName: rawName } = req.body;
    const content = typeof req.body.content === 'string' ? req.body.content.trim().slice(0, 4000) : '';
    const messageType = ['text', 'image', 'file'].includes(rawType) ? rawType : 'text';
    // an attachment link must be a normal web or stored-image address (never javascript: or data: pages)
    const attachmentUrl = rawUrl ? (safeImageRef(rawUrl) || safeHttpUrl(rawUrl)) : undefined;
    const attachmentName = typeof rawName === 'string' ? rawName.slice(0, 120) : undefined;

    if (!content) { sendError(res, 'Message content is required', 400); return; }
    if (rawUrl && !attachmentUrl) { sendError(res, 'Invalid attachment link', 400); return; }

    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: req.user!._id,
    });

    if (!conversation) { sendError(res, 'Conversation not found', 404); return; }

    const message = await Message.create({
      conversationId,
      senderId: req.user!._id,
      content,
      messageType,
      attachmentUrl,
      attachmentName,
      sentAt: new Date(),
    });

    await Conversation.findByIdAndUpdate(conversationId, {
      lastMessage: message._id,
      lastMessageAt: new Date(),
    });

    await message.populate('senderId', 'email role');

    // Live delivery comes from the server's stored copy, so the sender shown can never be faked by a client.
    const io = req.app.get('io');
    for (const p of conversation.participants) {
      if (p.toString() !== req.user!._id.toString()) io?.to(`user_${p.toString()}`).emit('receive_message', message);
    }
    sendSuccess(res, message, 'Message sent', 201);
  } catch { sendError(res, 'Failed to send message', 500); }
};

export const getUnreadCount = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const conversations = await Conversation.find({ participants: req.user!._id }).select('_id');
    const convIds = conversations.map((c) => c._id);

    const count = await Message.countDocuments({
      conversationId: { $in: convIds },
      senderId: { $ne: req.user!._id },
      isRead: false,
    });

    sendSuccess(res, { unreadCount: count });
  } catch { sendError(res, 'Failed to get unread count', 500); }
};
