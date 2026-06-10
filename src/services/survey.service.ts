import pool from '../db/client';
import { makeAppError } from './auth.service';

export interface Survey {
  id: string;
  visit_id: string;
  title: string;
  status: string;
  display_trigger: string;
  created_at: string;
  updated_at: string;
}

export interface SurveyWithQuestions extends Survey {
  questions: SurveyQuestion[];
}

export interface SurveyQuestion {
  id: string;
  survey_id: string;
  label: string;
  type: string;
  options: unknown | null;
  required: boolean;
  display_order: number;
}

export interface SurveyResponse {
  id: string;
  survey_id: string;
  visit_id: string;
  answers: Record<string, unknown>;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  gdpr_consent: boolean;
  submitted_at: string | null;
}

export interface CreateSurveyData {
  visit_id: string;
  title: string;
  display_trigger?: string;
}

export interface UpdateSurveyData {
  title?: string;
  status?: string;
  display_trigger?: string;
}

export interface CreateQuestionData {
  label: string;
  type: string;
  options?: unknown;
  required?: boolean;
  display_order?: number;
}

export interface UpdateQuestionData {
  label?: string;
  type?: string;
  options?: unknown;
  required?: boolean;
  display_order?: number;
}

export interface SubmitResponseData {
  visit_id: string;
  answers: Record<string, unknown>;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  gdpr_consent?: boolean;
}

export interface SurveyList {
  surveys: Survey[];
  total: number;
  page: number;
  limit: number;
}

export interface ResponseList {
  responses: SurveyResponse[];
  total: number;
  page: number;
  limit: number;
}

export async function listSurveys(orgId: string, filters: { page?: number; limit?: number }): Promise<SurveyList> {
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
  const offset = (page - 1) * limit;

  const countResult = await pool.query(
    `SELECT COUNT(*) AS total
     FROM surveys s
     JOIN visits v ON v.id = s.visit_id
     JOIN places p ON p.id = v.place_id
     WHERE p.organization_id = $1`,
    [orgId]
  );

  const total = parseInt(countResult.rows[0].total, 10);

  const selectResult = await pool.query(
    `SELECT s.id, s.visit_id, s.title, s.status, s.display_trigger, s.created_at, s.updated_at
     FROM surveys s
     JOIN visits v ON v.id = s.visit_id
     JOIN places p ON p.id = v.place_id
     WHERE p.organization_id = $1
     ORDER BY s.created_at DESC
     LIMIT $2 OFFSET $3`,
    [orgId, limit, offset]
  );

  return { surveys: selectResult.rows, total, page, limit };
}

export async function getSurvey(orgId: string, surveyId: string): Promise<SurveyWithQuestions> {
  const surveyResult = await pool.query(
    `SELECT s.id, s.visit_id, s.title, s.status, s.display_trigger, s.created_at, s.updated_at
     FROM surveys s
     JOIN visits v ON v.id = s.visit_id
     JOIN places p ON p.id = v.place_id
     WHERE s.id = $1 AND p.organization_id = $2`,
    [surveyId, orgId]
  );

  if (surveyResult.rows.length === 0) {
    throw makeAppError('Survey not found', 404, 'SURVEY_NOT_FOUND');
  }

  const questionsResult = await pool.query(
    `SELECT id, survey_id, label, type, options, required, display_order
     FROM survey_questions
     WHERE survey_id = $1
     ORDER BY display_order ASC`,
    [surveyId]
  );

  return { ...surveyResult.rows[0], questions: questionsResult.rows };
}

export async function getSurveyByVisit(orgId: string, visitId: string): Promise<SurveyWithQuestions> {
  // Verify visit ownership and get survey
  const surveyResult = await pool.query(
    `SELECT s.id, s.visit_id, s.title, s.status, s.display_trigger, s.created_at, s.updated_at
     FROM surveys s
     JOIN visits v ON v.id = s.visit_id
     JOIN places p ON p.id = v.place_id
     WHERE s.visit_id = $1 AND p.organization_id = $2`,
    [visitId, orgId]
  );

  if (surveyResult.rows.length === 0) {
    throw makeAppError('Survey not found', 404, 'SURVEY_NOT_FOUND');
  }

  const survey = surveyResult.rows[0];

  const questionsResult = await pool.query(
    `SELECT id, survey_id, label, type, options, required, display_order
     FROM survey_questions
     WHERE survey_id = $1
     ORDER BY display_order ASC`,
    [survey.id]
  );

  return { ...survey, questions: questionsResult.rows };
}

export async function createSurvey(orgId: string, data: CreateSurveyData): Promise<Survey> {
  // Verify visit ownership
  const visitResult = await pool.query(
    `SELECT v.id FROM visits v
     JOIN places p ON p.id = v.place_id
     WHERE v.id = $1 AND p.organization_id = $2`,
    [data.visit_id, orgId]
  );

  if (visitResult.rows.length === 0) {
    throw makeAppError('Visit not found', 404, 'VISIT_NOT_FOUND');
  }

  try {
    const result = await pool.query(
      `INSERT INTO surveys (visit_id, title, display_trigger)
       VALUES ($1, $2, $3)
       RETURNING id, visit_id, title, status, display_trigger, created_at, updated_at`,
      [data.visit_id, data.title, data.display_trigger ?? 'end']
    );
    return result.rows[0];
  } catch (err: any) {
    if (err.code === '23505') {
      throw makeAppError('Survey already exists for this visit', 409, 'SURVEY_ALREADY_EXISTS');
    }
    throw err;
  }
}

export async function updateSurvey(orgId: string, surveyId: string, data: UpdateSurveyData): Promise<Survey> {
  const fields: string[] = [];
  const params: unknown[] = [];

  if (data.title !== undefined) { params.push(data.title); fields.push(`title = $${params.length}`); }
  if (data.status !== undefined) { params.push(data.status); fields.push(`status = $${params.length}`); }
  if (data.display_trigger !== undefined) { params.push(data.display_trigger); fields.push(`display_trigger = $${params.length}`); }

  if (fields.length === 0) {
    return getSurvey(orgId, surveyId);
  }

  params.push(surveyId);
  const surveyParam = params.length;
  params.push(orgId);
  const orgParam = params.length;

  const result = await pool.query(
    `UPDATE surveys s SET ${fields.join(', ')}, updated_at = NOW()
     FROM visits v JOIN places p ON p.id = v.place_id
     WHERE s.id = $${surveyParam} AND s.visit_id = v.id AND p.organization_id = $${orgParam}
     RETURNING s.id, s.visit_id, s.title, s.status, s.display_trigger, s.created_at, s.updated_at`,
    params
  );

  if (result.rows.length === 0) {
    throw makeAppError('Survey not found', 404, 'SURVEY_NOT_FOUND');
  }

  return result.rows[0];
}

export async function deleteSurvey(orgId: string, surveyId: string): Promise<void> {
  const result = await pool.query(
    `DELETE FROM surveys s
     USING visits v, places p
     WHERE s.id = $1 AND s.visit_id = v.id AND v.place_id = p.id AND p.organization_id = $2`,
    [surveyId, orgId]
  );

  if ((result as any).rowCount === 0) {
    throw makeAppError('Survey not found', 404, 'SURVEY_NOT_FOUND');
  }
}

export async function addQuestion(orgId: string, surveyId: string, data: CreateQuestionData): Promise<SurveyQuestion> {
  // Verify survey ownership
  const ownerCheck = await pool.query(
    `SELECT s.id FROM surveys s
     JOIN visits v ON v.id = s.visit_id
     JOIN places p ON p.id = v.place_id
     WHERE s.id = $1 AND p.organization_id = $2`,
    [surveyId, orgId]
  );

  if (ownerCheck.rows.length === 0) {
    throw makeAppError('Survey not found', 404, 'SURVEY_NOT_FOUND');
  }

  const result = await pool.query(
    `INSERT INTO survey_questions (survey_id, label, type, options, required, display_order)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, survey_id, label, type, options, required, display_order`,
    [surveyId, data.label, data.type, data.options ?? null, data.required ?? false, data.display_order ?? 0]
  );

  return result.rows[0];
}

export async function updateQuestion(orgId: string, surveyId: string, qId: string, data: UpdateQuestionData): Promise<SurveyQuestion> {
  const fields: string[] = [];
  const params: unknown[] = [];

  if (data.label !== undefined) { params.push(data.label); fields.push(`label = $${params.length}`); }
  if (data.type !== undefined) { params.push(data.type); fields.push(`type = $${params.length}`); }
  if (data.options !== undefined) { params.push(data.options); fields.push(`options = $${params.length}`); }
  if (data.required !== undefined) { params.push(data.required); fields.push(`required = $${params.length}`); }
  if (data.display_order !== undefined) { params.push(data.display_order); fields.push(`display_order = $${params.length}`); }

  if (fields.length === 0) {
    const q = await pool.query('SELECT id, survey_id, label, type, options, required, display_order FROM survey_questions WHERE id = $1', [qId]);
    if (q.rows.length === 0) throw makeAppError('Question not found', 404, 'QUESTION_NOT_FOUND');
    return q.rows[0];
  }

  params.push(qId);
  const qParam = params.length;
  params.push(surveyId);
  const sParam = params.length;
  params.push(orgId);
  const orgParam = params.length;

  const result = await pool.query(
    `UPDATE survey_questions sq SET ${fields.join(', ')}
     FROM surveys s JOIN visits v ON v.id = s.visit_id JOIN places p ON p.id = v.place_id
     WHERE sq.id = $${qParam} AND sq.survey_id = $${sParam} AND s.id = $${sParam} AND p.organization_id = $${orgParam}
     RETURNING sq.id, sq.survey_id, sq.label, sq.type, sq.options, sq.required, sq.display_order`,
    params
  );

  if (result.rows.length === 0) {
    throw makeAppError('Question not found', 404, 'QUESTION_NOT_FOUND');
  }

  return result.rows[0];
}

export async function deleteQuestion(orgId: string, surveyId: string, qId: string): Promise<void> {
  const result = await pool.query(
    `DELETE FROM survey_questions sq
     USING surveys s, visits v, places p
     WHERE sq.id = $1 AND sq.survey_id = $2 AND s.id = $2 AND s.visit_id = v.id AND v.place_id = p.id AND p.organization_id = $3`,
    [qId, surveyId, orgId]
  );

  if ((result as any).rowCount === 0) {
    throw makeAppError('Question not found', 404, 'QUESTION_NOT_FOUND');
  }
}

export async function submitResponse(surveyId: string, data: SubmitResponseData): Promise<SurveyResponse> {
  // Verify survey exists and is active
  const surveyResult = await pool.query(
    `SELECT id, status FROM surveys WHERE id = $1`,
    [surveyId]
  );

  if (surveyResult.rows.length === 0) {
    throw makeAppError('Survey not found', 404, 'SURVEY_NOT_FOUND');
  }

  if (surveyResult.rows[0].status !== 'active') {
    throw makeAppError('Survey is not active', 400, 'SURVEY_INACTIVE');
  }

  const result = await pool.query(
    `INSERT INTO survey_responses (survey_id, visit_id, answers, contact_name, contact_email, contact_phone, gdpr_consent, submitted_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
     RETURNING id, survey_id, visit_id, answers, contact_name, contact_email, contact_phone, gdpr_consent, submitted_at`,
    [
      surveyId,
      data.visit_id,
      JSON.stringify(data.answers ?? {}),
      data.contact_name ?? null,
      data.contact_email ?? null,
      data.contact_phone ?? null,
      data.gdpr_consent ?? false,
    ]
  );

  return result.rows[0];
}

export async function listResponses(orgId: string, surveyId: string, filters: { page?: number; limit?: number }): Promise<ResponseList> {
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
  const offset = (page - 1) * limit;

  // Verify survey ownership
  const ownerCheck = await pool.query(
    `SELECT s.id FROM surveys s
     JOIN visits v ON v.id = s.visit_id
     JOIN places p ON p.id = v.place_id
     WHERE s.id = $1 AND p.organization_id = $2`,
    [surveyId, orgId]
  );

  if (ownerCheck.rows.length === 0) {
    throw makeAppError('Survey not found', 404, 'SURVEY_NOT_FOUND');
  }

  const countResult = await pool.query(
    `SELECT COUNT(*) AS total FROM survey_responses WHERE survey_id = $1`,
    [surveyId]
  );

  const total = parseInt(countResult.rows[0].total, 10);

  const selectResult = await pool.query(
    `SELECT id, survey_id, visit_id, answers, contact_name, contact_email, contact_phone, gdpr_consent, submitted_at
     FROM survey_responses
     WHERE survey_id = $1
     ORDER BY submitted_at DESC
     LIMIT $2 OFFSET $3`,
    [surveyId, limit, offset]
  );

  return { responses: selectResult.rows, total, page, limit };
}
