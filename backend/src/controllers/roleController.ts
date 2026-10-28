import { Response } from 'express';
import { AuthRequest } from '../types';
import { User } from '../models/User';
import { AthleteProfile } from '../models/AthleteProfile';
import { CoachProfile } from '../models/CoachProfile';
import { generateSlug } from './../utils/jwt';
import { sendError, sendSuccess } from '../utils/response';
import { logEvent } from '../utils/activity';

/**
 * First sign-in step for a new account: "Are you a player or a coach?". Only available once, while the
 * account is still flagged needsRoleSelection. Picking coach swaps the empty placeholder player profile
 * for a coach profile, so counts and the admin lists stay accurate.
 */
export const chooseRole = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const role = String(req.body?.role ?? '');
    if (role !== 'athlete' && role !== 'coach') {
      sendError(res, 'Choose player or coach', 400, 'VALIDATION_ERROR');
      return;
    }
    const user = await User.findById(req.user!._id);
    if (!user) { sendError(res, 'User not found', 404); return; }
    if (!user.needsRoleSelection) {
      sendError(res, 'Your account type is already set', 409, 'ROLE_ALREADY_SET');
      return;
    }

    if (role === 'coach') {
      const placeholder = await AthleteProfile.findOne({ userId: user._id });
      if (placeholder && placeholder.fullName === 'Player' && !placeholder.primarySport) await placeholder.deleteOne();
      const existing = await CoachProfile.findOne({ userId: user._id });
      if (!existing) {
        await CoachProfile.create({ userId: user._id, fullName: 'Coach', profileUrl: generateSlug(user._id.toString()) });
      }
    }

    user.role = role;
    user.needsRoleSelection = false;
    await user.save();
    void logEvent(user._id.toString(), 'USER_SIGNUP', { meta: { role: role === 'coach' ? 'coach' : 'player', step: 'role_selected' } });
    sendSuccess(res, { user }, 'Account type saved');
  } catch {
    sendError(res, 'Could not save your choice', 500);
  }
};
