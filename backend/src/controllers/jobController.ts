import mongoose from 'mongoose';
import { Response } from 'express';
import { AuthRequest } from '../types';
import { Job } from '../models/Job';
import { JobApplication } from '../models/JobApplication';
import { Organization } from '../models/Organization';
import { Notification } from '../models/Notification';
import { sendSuccess, sendError } from '../utils/response';
import { getProfileName } from '../utils/profile';
import { asString, escapeRegex } from '../utils/security';

const JOB_FIELDS = [
  'title', 'description', 'category', 'location', 'jobType', 'experienceLevel', 'salaryMin', 'salaryMax', 'requirements',
  'skills', 'applicationDeadline', 'openings', 'benefits', 'sports',
];
const pick = (body: Record<string, unknown>, fields: string[]) =>
  Object.fromEntries(fields.filter((f) => body[f] !== undefined).map((f) => [f, body[f]]));

export const createJob = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const org = await Organization.findOne({ userId: req.user!._id });
    if (!org) { sendError(res, 'Organization profile required', 403); return; }

    const job = await Job.create({
      ...pick(req.body, JOB_FIELDS),
      organizationId: org._id,
      createdBy: req.user!._id,
      status: 'draft',
    });

    sendSuccess(res, job, 'Job created', 201);
  } catch { sendError(res, 'Failed to create job', 500); }
};

export const submitJobForReview = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const job = await Job.findOne({ _id: req.params.id, createdBy: req.user!._id });
    if (!job) { sendError(res, 'Job not found', 404); return; }
    if (job.status !== 'draft') { sendError(res, 'Only draft jobs can be submitted', 400); return; }

    job.status = 'pending';
    await job.save();
    sendSuccess(res, job, 'Job submitted for review');
  } catch { sendError(res, 'Failed to submit job', 500); }
};

export const getJobs = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const category = asString(req.query.category); const jobType = asString(req.query.jobType);
    const experience = asString(req.query.experience); const q = asString(req.query.q, 80); const location = asString(req.query.location, 80);
    const page = Math.max(1, parseInt(String(req.query.page)) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit)) || 20));
    const skip = (page - 1) * limit;
    const query: Record<string, unknown> = { status: 'published' };

    if (category) query.category = category;
    if (jobType) query.jobType = jobType;
    if (experience) query.experienceLevel = experience;
    if (q) query.$text = { $search: q };
    if (location) query.location = new RegExp(escapeRegex(location), 'i');

    const [jobs, total] = await Promise.all([
      Job.find(query)
        .populate('organizationId', 'name logo isVerified')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Job.countDocuments(query),
    ]);

    sendSuccess(res, jobs, 'Jobs fetched', 200, {
      total, page, pages: Math.ceil(total / limit), limit,
    });
  } catch { sendError(res, 'Failed to fetch jobs', 500); }
};

export const getJob = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // a malformed id (old link, typo) is "not found", not a server error
    if (!mongoose.isValidObjectId(req.params.id)) { sendError(res, 'Job not found', 404); return; }
    const job = await Job.findById(req.params.id).populate('organizationId', req.user ? 'name logo isVerified type contact' : 'name logo isVerified type');
    if (!job) { sendError(res, 'Job not found', 404); return; }
    const isOwner = !!req.user && (job.createdBy?.toString() === req.user._id.toString() || req.user.role === 'admin');
    if (job.status !== 'published' && !isOwner) { sendError(res, 'Job not found', 404); return; }

    let userApplication = null;
    if (req.user) {
      userApplication = await JobApplication.findOne({ jobId: job._id, applicantId: req.user._id });
    }

    sendSuccess(res, { job, userApplication });
  } catch { sendError(res, 'Failed to get job', 500); }
};

export const applyToJob = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job || job.status !== 'published') { sendError(res, 'Job not available', 400); return; }

    if (job.applicationDeadline && job.applicationDeadline < new Date()) {
      sendError(res, 'Application deadline passed', 400); return;
    }

    const existing = await JobApplication.findOne({ jobId: job._id, applicantId: req.user!._id });
    if (existing) { sendError(res, 'Already applied', 409); return; }

    const application = await JobApplication.create({
      jobId: job._id,
      applicantId: req.user!._id,
      coverLetter: typeof req.body.coverLetter === 'string' ? req.body.coverLetter.slice(0, 5000) : undefined,
    });

    await Job.findByIdAndUpdate(job._id, { $inc: { applicantCount: 1 } });

    // Send notification to job creator
    const applicantName = await getProfileName(req.user!._id.toString(), req.user!.role);
    await Notification.create({
      recipientId: job.createdBy,
      type: 'job_application',
      title: 'New Job Application',
      message: `${applicantName} applied for your job: ${job.title}`,
      referenceId: application._id,
      referenceType: 'JobApplication',
      link: `/jobs/${job._id}/applications`,
    });

    sendSuccess(res, application, 'Application submitted', 201);
  } catch { sendError(res, 'Failed to apply', 500); }
};

export const getJobApplications = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const job = await Job.findOne({ _id: req.params.id, createdBy: req.user!._id });
    if (!job) { sendError(res, 'Job not found', 404); return; }

    const status = asString(req.query.status);
    const page = Math.max(1, parseInt(String(req.query.page)) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit)) || 50));
    const skip = (Number(page) - 1) * Number(limit);
    const query: Record<string, unknown> = { jobId: job._id };
    if (status) query.status = status;

    const [applications, total] = await Promise.all([
      JobApplication.find(query)
        .populate('applicantId', 'email role')
        .skip(skip)
        .limit(Number(limit))
        .sort({ appliedAt: -1 }),
      JobApplication.countDocuments(query),
    ]);

    sendSuccess(res, applications, 'Applications fetched', 200, {
      total, page: Number(page), pages: Math.ceil(total / Number(limit)), limit: Number(limit),
    });
  } catch { sendError(res, 'Failed to get applications', 500); }
};

export const updateJobApplicationStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const app = await JobApplication.findById(req.params.appId);
    if (!app) { sendError(res, 'Application not found', 404); return; }

    const job = await Job.findOne({ _id: app.jobId, createdBy: req.user!._id });
    if (!job) { sendError(res, 'Not authorized', 403); return; }

    if (!['applied', 'shortlisted', 'rejected'].includes(req.body.status)) { sendError(res, 'Invalid status', 400); return; }
    app.status = req.body.status;
    if (typeof req.body.reason === 'string') app.rejectionReason = req.body.reason.slice(0, 500);
    app.statusUpdatedAt = new Date();
    await app.save();

    await Notification.create({
      recipientId: app.applicantId,
      type: 'application_status',
      title: `Job Application ${req.body.status}`,
      message: `Your application for "${job.title}" has been ${req.body.status}`,
      referenceId: app._id,
      referenceType: 'JobApplication',
    });

    sendSuccess(res, app, 'Status updated');
  } catch { sendError(res, 'Failed to update status', 500); }
};

export const getMyJobApplications = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const applications = await JobApplication.find({ applicantId: req.user!._id })
      .populate({ path: 'jobId', populate: { path: 'organizationId', select: 'name logo' } })
      .sort({ appliedAt: -1 });
    sendSuccess(res, applications);
  } catch { sendError(res, 'Failed to get job applications', 500); }
};

export const saveJob = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { jobId } = req.body;
    if (!mongoose.isValidObjectId(jobId) || !(await Job.exists({ _id: jobId, status: 'published' }))) { sendError(res, 'Job not found', 404); return; }
    const existing = await JobApplication.findOne({ jobId, applicantId: req.user!._id });
    if (!existing) {
      await JobApplication.create({ jobId, applicantId: req.user!._id, status: 'applied', savedBy: [req.user!._id] });
    }
    sendSuccess(res, null, 'Job saved');
  } catch { sendError(res, 'Failed to save job', 500); }
};

export const getMyOrgJobs = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const org = await Organization.findOne({ userId: req.user!._id });
    if (!org) { sendError(res, 'Organization not found', 404); return; }
    const jobs = await Job.find({ organizationId: org._id }).sort({ createdAt: -1 });
    sendSuccess(res, jobs);
  } catch { sendError(res, 'Failed to get jobs', 500); }
};
