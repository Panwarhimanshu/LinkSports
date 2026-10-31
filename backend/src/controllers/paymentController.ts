import { Response } from 'express';
import mongoose from 'mongoose';
import crypto from 'crypto';
import { AuthRequest } from '../types';
import { Payment, Coupon } from '../models/Payment';
import { Listing } from '../models/Listing';
import { Job } from '../models/Job';
import { sendSuccess, sendError } from '../utils/response';

const LISTING_FEE = 50;

let razorpay: any = null;

const getRazorpay = async () => {
  if (razorpay) return razorpay;
  if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_ID !== 'your_razorpay_key_id') {
    const Razorpay = (await import('razorpay')).default;
    razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  }
  return razorpay;
};

const isProd = () => process.env.NODE_ENV === 'production';

/** The listing or job being paid for must exist and belong to the person paying. */
const ownsReference = async (userId: unknown, referenceType: unknown, referenceId: unknown): Promise<boolean> => {
  if (!mongoose.isValidObjectId(referenceId)) return false;
  const model: any = referenceType === 'Listing' ? Listing : referenceType === 'Job' ? Job : null;
  if (!model) return false;
  return !!(await model.exists({ _id: referenceId, createdBy: userId }));
};

const discountFor = (coupon: any, amount: number): number =>
  coupon.discountType === 'percentage' ? Math.floor((amount * Math.min(100, Math.max(0, coupon.discountValue))) / 100) : Math.min(Math.max(0, coupon.discountValue), amount);

export const createOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (req.user!.role !== 'organization') { sendError(res, 'Only organizations can pay listing fees', 403); return; }
    const { referenceId, referenceType } = req.body;
    const couponCode = typeof req.body.couponCode === 'string' ? req.body.couponCode.trim().toUpperCase().slice(0, 40) : '';

    // The price, type and what is being paid for are all decided here, never taken from the request.
    if (!(await ownsReference(req.user!._id, referenceType, referenceId))) { sendError(res, 'Nothing to pay for', 400); return; }
    if (await Payment.exists({ userId: req.user!._id, referenceId, referenceType, status: 'success' })) {
      sendError(res, 'This item is already paid for', 409); return;
    }

    let amount = LISTING_FEE;
    let discountAmount = 0;
    let appliedCoupon: string | undefined;

    if (couponCode) {
      const coupon = await Coupon.findOne({ code: couponCode, isActive: true });
      const now = new Date();
      const usable = coupon
        && coupon.validFrom <= now
        && (!coupon.validUntil || coupon.validUntil > now)
        && (!coupon.usageLimit || coupon.usedCount < coupon.usageLimit)
        // one use per account: a coupon can't be applied again by the person who already used it
        && !(await Payment.exists({ userId: req.user!._id, couponCode, status: 'success' }));
      if (!usable) { sendError(res, 'This coupon cannot be used', 400); return; }
      discountAmount = discountFor(coupon, amount);
      appliedCoupon = couponCode;
    }

    amount = Math.max(0, amount - discountAmount);

    // Real money needs a real payment gateway. Without one, production refuses instead of "pretending" it was paid.
    const rzp = amount > 0 ? await getRazorpay() : null;
    if (amount > 0 && !rzp && isProd()) { sendError(res, 'Online payments are not available right now', 503); return; }

    const payment = await Payment.create({
      userId: req.user!._id, type: 'listing_fee', amount, discountAmount, couponCode: appliedCoupon,
      referenceId, referenceType, status: 'pending',
    });

    if (amount === 0) {
      await settlePayment(payment._id.toString(), req.user!._id.toString(), {});
      sendSuccess(res, { payment: await Payment.findById(payment._id), orderId: null, amount: 0, isFree: true });
      return;
    }

    if (!rzp) {
      // development only
      payment.razorpayOrderId = `mock_order_${payment._id}`;
      await payment.save();
      sendSuccess(res, { payment, orderId: payment.razorpayOrderId, amount: amount * 100, key: 'mock_key', isMock: true });
      return;
    }

    const order = await rzp.orders.create({
      amount: amount * 100,
      currency: 'INR',
      receipt: payment._id.toString(),
      notes: { paymentId: payment._id.toString(), referenceId: String(referenceId), referenceType },
    });

    payment.razorpayOrderId = order.id;
    await payment.save();

    sendSuccess(res, { payment, orderId: order.id, amount: amount * 100, key: process.env.RAZORPAY_KEY_ID, currency: 'INR' });
  } catch { sendError(res, 'Failed to create payment order', 500); }
};

/**
 * Marks a pending payment as paid exactly once (an atomic pending -> success switch, so replays do nothing),
 * then counts the coupon and releases the listing / job for review.
 */
const settlePayment = async (paymentId: string, userId: string, gateway: { razorpayPaymentId?: string; razorpaySignature?: string }) => {
  const payment = await Payment.findOneAndUpdate(
    { _id: paymentId, userId, status: 'pending' },
    { status: 'success', ...gateway },
    { new: true },
  );
  if (!payment) return null;

  if (payment.couponCode) await Coupon.updateOne({ code: payment.couponCode }, { $inc: { usedCount: 1 } });
  const model: any = payment.referenceType === 'Listing' ? Listing : payment.referenceType === 'Job' ? Job : null;
  if (model && payment.referenceId) await model.updateOne({ _id: payment.referenceId, createdBy: userId }, { paymentId: payment._id, status: 'pending' });
  return payment;
};

export const verifyPayment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { paymentId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;
    if (!mongoose.isValidObjectId(paymentId)) { sendError(res, 'Payment not found', 404); return; }

    // only the person who started this payment can finish it
    const payment = await Payment.findOne({ _id: paymentId, userId: req.user!._id });
    if (!payment) { sendError(res, 'Payment not found', 404); return; }
    if (payment.status !== 'pending') { sendError(res, 'This payment is already processed', 409); return; }

    const mock = !!payment.razorpayOrderId?.startsWith('mock_order_');
    if (mock) {
      // mock orders exist only in development
      if (isProd()) { sendError(res, 'Payment verification failed', 400); return; }
    } else {
      const secret = process.env.RAZORPAY_KEY_SECRET;
      if (!secret) { sendError(res, 'Online payments are not available right now', 503); return; }
      // The order, payment id and signature must ALL be present and must belong to this payment's order.
      if (typeof razorpayOrderId !== 'string' || typeof razorpayPaymentId !== 'string' || typeof razorpaySignature !== 'string'
        || !payment.razorpayOrderId || razorpayOrderId !== payment.razorpayOrderId) {
        sendError(res, 'Payment verification failed', 400); return;
      }
      const expected = crypto.createHmac('sha256', secret).update(`${razorpayOrderId}|${razorpayPaymentId}`).digest('hex');
      const a = Buffer.from(expected);
      const b = Buffer.from(razorpaySignature);
      if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
        await Payment.updateOne({ _id: payment._id, status: 'pending' }, { status: 'failed' });
        sendError(res, 'Payment verification failed', 400); return;
      }
    }

    const settled = await settlePayment(payment._id.toString(), req.user!._id.toString(),
      mock ? {} : { razorpayPaymentId, razorpaySignature });
    if (!settled) { sendError(res, 'This payment is already processed', 409); return; }
    sendSuccess(res, settled, 'Payment verified');
  } catch { sendError(res, 'Payment verification failed', 500); }
};

export const getTransactionHistory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const payments = await Payment.find({ userId: req.user!._id }).sort({ createdAt: -1 });
    sendSuccess(res, payments);
  } catch { sendError(res, 'Failed to get transactions', 500); }
};

export const validateCoupon = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const code = typeof req.body?.code === 'string' ? req.body.code.trim().toUpperCase().slice(0, 40) : '';
    const coupon = code ? await Coupon.findOne({ code, isActive: true }) : null;

    if (!coupon) { sendError(res, 'Invalid coupon code', 400); return; }

    const now = new Date();
    if (coupon.validFrom > now || (coupon.validUntil && coupon.validUntil < now)) {
      sendError(res, 'Coupon expired', 400); return;
    }
    if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
      sendError(res, 'Coupon usage limit reached', 400); return;
    }

    const amount = LISTING_FEE;
    let discountAmount = 0;
    if (coupon.discountType === 'percentage') {
      discountAmount = Math.floor(amount * coupon.discountValue / 100);
    } else {
      discountAmount = Math.min(coupon.discountValue, amount);
    }

    if (await Payment.exists({ userId: req.user!._id, couponCode: coupon.code, status: 'success' })) {
      sendError(res, 'You have already used this coupon', 400); return;
    }

    sendSuccess(res, {
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      discountAmount,
      finalAmount: amount - discountAmount,
    });
  } catch { sendError(res, 'Coupon validation failed', 500); }
};
