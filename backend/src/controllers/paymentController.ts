import { Response } from 'express';
import crypto from 'crypto';
import mongoose from 'mongoose';
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

/** Takes one use of a coupon, respecting its limit atomically. Returns false when none is left. */
const takeCouponUse = async (code: string): Promise<boolean> => {
  const hit = await Coupon.findOneAndUpdate(
    { code, isActive: true, $or: [{ usageLimit: { $in: [null, 0] } }, { $expr: { $lt: ['$usedCount', '$usageLimit'] } }] },
    { $inc: { usedCount: 1 } },
  );
  return Boolean(hit);
};

const REFERENCE_MODELS = { Listing, Job } as const;

export const createOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { type, referenceId, referenceType } = req.body ?? {};
    const couponCode = typeof req.body?.couponCode === 'string' ? req.body.couponCode.trim().toUpperCase() : undefined;

    // The thing being paid for must exist and belong to the payer.
    if (referenceType !== 'Listing' && referenceType !== 'Job') { sendError(res, 'Invalid reference', 400); return; }
    if (typeof type !== 'string' || !mongoose.isValidObjectId(referenceId)) { sendError(res, 'Invalid reference', 400); return; }
    const owned = await (REFERENCE_MODELS[referenceType as 'Listing' | 'Job'] as any).exists({ _id: referenceId, createdBy: req.user!._id });
    if (!owned) { sendError(res, 'Item not found', 404); return; }

    let amount = LISTING_FEE;
    let discountAmount = 0;
    let appliedCoupon: string | undefined;

    if (couponCode) {
      const coupon = await Coupon.findOne({ code: couponCode, isActive: true });
      if (coupon) {
        const now = new Date();
        if ((!coupon.validUntil || coupon.validUntil > now) && coupon.validFrom <= now
          && (!coupon.usageLimit || coupon.usedCount < coupon.usageLimit)) {
          discountAmount = coupon.discountType === 'percentage'
            ? Math.floor(amount * coupon.discountValue / 100)
            : Math.min(coupon.discountValue, amount);
          appliedCoupon = couponCode;
        }
      }
    }

    amount = Math.max(0, amount - discountAmount);

    const payment = await Payment.create({
      userId: req.user!._id,
      type,
      amount,
      discountAmount,
      couponCode: appliedCoupon,
      referenceId,
      referenceType,
      status: 'pending',
    });

    if (amount === 0) {
      if (appliedCoupon && !(await takeCouponUse(appliedCoupon))) {
        await Payment.deleteOne({ _id: payment._id });
        sendError(res, 'Coupon usage limit reached', 400); return;
      }
      payment.status = 'success';
      await payment.save();
      await (REFERENCE_MODELS[referenceType as 'Listing' | 'Job'] as any).updateOne({ _id: referenceId, createdBy: req.user!._id }, { paymentId: payment._id, status: 'pending' });
      sendSuccess(res, { payment, orderId: null, amount: 0, isFree: true });
      return;
    }

    const rzp = await getRazorpay();
    if (!rzp) {
      if (isProd()) { await Payment.deleteOne({ _id: payment._id }); sendError(res, 'Payments are not available right now', 503); return; }
      sendSuccess(res, {
        payment, orderId: `mock_order_${Date.now()}`, amount: amount * 100,
        key: 'mock_key', isMock: true,
      });
      return;
    }

    const order = await rzp.orders.create({
      amount: amount * 100,
      currency: 'INR',
      receipt: payment._id.toString(),
      notes: { paymentId: payment._id.toString(), type, referenceId, referenceType },
    });

    payment.razorpayOrderId = order.id;
    await payment.save();

    sendSuccess(res, {
      payment,
      orderId: order.id,
      amount: amount * 100,
      key: process.env.RAZORPAY_KEY_ID,
      currency: 'INR',
    });
  } catch { sendError(res, 'Failed to create payment order', 500); }
};

export const verifyPayment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { paymentId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body ?? {};
    if (!mongoose.isValidObjectId(paymentId)) { sendError(res, 'Payment not found', 404); return; }

    // Only the payer can verify their own payment.
    const payment = await Payment.findOne({ _id: paymentId, userId: req.user!._id });
    if (!payment) { sendError(res, 'Payment not found', 404); return; }
    if (payment.status === 'success') { sendSuccess(res, payment, 'Payment verified'); return; }

    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (secret && process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_ID !== 'your_razorpay_key_id') {
      // A signature for the order we created is mandatory; there is no path to "success" without it.
      if (typeof razorpayOrderId !== 'string' || typeof razorpayPaymentId !== 'string' || typeof razorpaySignature !== 'string'
        || !payment.razorpayOrderId || razorpayOrderId !== payment.razorpayOrderId) {
        sendError(res, 'Payment verification failed', 400); return;
      }
      const expectedSig = crypto.createHmac('sha256', secret).update(`${razorpayOrderId}|${razorpayPaymentId}`).digest('hex');
      const a = Buffer.from(expectedSig);
      const b = Buffer.from(razorpaySignature);
      if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
        await Payment.updateOne({ _id: payment._id, status: 'pending' }, { status: 'failed' });
        sendError(res, 'Payment verification failed', 400); return;
      }
    } else if (isProd()) {
      sendError(res, 'Payments are not available right now', 503); return;
    } // else: local development with the mock gateway

    // Flip pending -> success exactly once; replays and parallel calls find nothing to flip.
    const done = await Payment.findOneAndUpdate(
      { _id: payment._id, status: 'pending' },
      { status: 'success', razorpayPaymentId, razorpaySignature },
      { new: true },
    );
    if (!done) { sendSuccess(res, payment, 'Payment verified'); return; }

    if (done.couponCode) await takeCouponUse(done.couponCode);

    if (done.referenceId && (done.referenceType === 'Listing' || done.referenceType === 'Job')) {
      await (REFERENCE_MODELS[done.referenceType] as any).updateOne({ _id: done.referenceId, createdBy: req.user!._id }, { paymentId: done._id, status: 'pending' });
    }

    sendSuccess(res, done, 'Payment verified');
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
    const { code } = req.body;
    const coupon = await Coupon.findOne({ code: code.toUpperCase(), isActive: true });

    if (!coupon) { sendError(res, 'Invalid coupon code', 400); return; }

    const now = new Date();
    if (coupon.validUntil && coupon.validUntil < now) {
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

    sendSuccess(res, {
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      discountAmount,
      finalAmount: amount - discountAmount,
    });
  } catch { sendError(res, 'Coupon validation failed', 500); }
};
