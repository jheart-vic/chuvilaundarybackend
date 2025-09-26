import Issue from '../models/Issue.js';


export async function createIssue(req, res, next) {
try {
const issue = await Issue.create({
name: req.validated.name,
phone: req.validated.phone,
order: req.validated.order,
message: req.validated.message
});
return res.status(201).json({ success: true, issue });
} catch (err) { next(err); }
}


export async function listIssues(req, res, next) {
try {
const issues = await Issue.find({}).sort({ createdAt: -1 }).limit(200);
return res.json({ success: true, issues });
} catch (err) { next(err); }
}