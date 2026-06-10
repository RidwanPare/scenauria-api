jest.mock('../db/client', () => ({
  default: { query: jest.fn() },
  __esModule: true,
}));

import pool from '../db/client';
import {
  listSurveys,
  getSurvey,
  getSurveyByVisit,
  createSurvey,
  updateSurvey,
  deleteSurvey,
  addQuestion,
  submitResponse,
} from '../services/survey.service';

const mockQuery = pool.query as jest.Mock;

describe('listSurveys', () => {
  beforeEach(() => jest.clearAllMocks());

  it('retourne les surveys paginés avec total', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ total: 2 }] })
      .mockResolvedValueOnce({ rows: [{ id: 's1' }, { id: 's2' }] });

    const result = await listSurveys('org-uuid', {});
    expect(result.total).toBe(2);
    expect(result.surveys).toHaveLength(2);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
  });

  it('applique la pagination correctement', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ total: 50 }] })
      .mockResolvedValueOnce({ rows: [] });

    const result = await listSurveys('org-uuid', { page: 2, limit: 10 });
    expect(result.page).toBe(2);
    expect(result.limit).toBe(10);
  });
});

describe('getSurvey', () => {
  beforeEach(() => jest.clearAllMocks());

  it('retourne le survey avec ses questions', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 's1', title: 'Feedback', status: 'active' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'q1', label: 'Comment?' }] });

    const result = await getSurvey('org-uuid', 's1');
    expect(result.id).toBe('s1');
    expect(result.questions).toHaveLength(1);
    expect(result.questions[0].label).toBe('Comment?');
  });

  it('lève 404 SURVEY_NOT_FOUND si inexistant', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await expect(getSurvey('org-uuid', 'unknown')).rejects.toMatchObject({
      statusCode: 404,
      code: 'SURVEY_NOT_FOUND',
    });
  });
});

describe('getSurveyByVisit', () => {
  beforeEach(() => jest.clearAllMocks());

  it('retourne le survey de la visite avec questions', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 's1', visit_id: 'v1' }] })
      .mockResolvedValueOnce({ rows: [] });

    const result = await getSurveyByVisit('org-uuid', 'v1');
    expect(result.id).toBe('s1');
    expect(result.questions).toHaveLength(0);
  });

  it('lève SURVEY_NOT_FOUND si aucun survey pour la visite', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await expect(getSurveyByVisit('org-uuid', 'v-none')).rejects.toMatchObject({
      statusCode: 404,
      code: 'SURVEY_NOT_FOUND',
    });
  });
});

describe('createSurvey', () => {
  beforeEach(() => jest.clearAllMocks());

  it('crée un survey', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'v1' }] }) // visit check
      .mockResolvedValueOnce({ rows: [{ id: 's1', title: 'Feedback', visit_id: 'v1' }] }); // insert

    const result = await createSurvey('org-uuid', { visit_id: 'v1', title: 'Feedback' });
    expect(result.id).toBe('s1');
    expect(result.title).toBe('Feedback');
  });

  it('lève VISIT_NOT_FOUND si la visite n appartient pas à l org', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] }); // visit check empty
    await expect(createSurvey('org-uuid', { visit_id: 'v-none', title: 'X' })).rejects.toMatchObject({
      statusCode: 404,
      code: 'VISIT_NOT_FOUND',
    });
  });

  it('lève SURVEY_ALREADY_EXISTS sur violation unique', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 'v1' }] }); // visit check
    mockQuery.mockRejectedValueOnce({ code: '23505' }); // unique violation
    await expect(createSurvey('org-uuid', { visit_id: 'v1', title: 'X' })).rejects.toMatchObject({
      statusCode: 409,
      code: 'SURVEY_ALREADY_EXISTS',
    });
  });
});

describe('updateSurvey', () => {
  beforeEach(() => jest.clearAllMocks());

  it('met à jour le survey', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 's1', title: 'Updated' }] });
    const result = await updateSurvey('org-uuid', 's1', { title: 'Updated' });
    expect(result.title).toBe('Updated');
  });

  it('lève 404 SURVEY_NOT_FOUND', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    await expect(updateSurvey('org-uuid', 'unknown', { title: 'X' })).rejects.toMatchObject({
      statusCode: 404,
      code: 'SURVEY_NOT_FOUND',
    });
  });
});

describe('deleteSurvey', () => {
  beforeEach(() => jest.clearAllMocks());

  it('supprime le survey', async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 1 });
    await expect(deleteSurvey('org-uuid', 's1')).resolves.toBeUndefined();
  });

  it('lève 404 SURVEY_NOT_FOUND si inexistant', async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 0 });
    await expect(deleteSurvey('org-uuid', 'unknown')).rejects.toMatchObject({
      statusCode: 404,
      code: 'SURVEY_NOT_FOUND',
    });
  });
});

describe('addQuestion', () => {
  beforeEach(() => jest.clearAllMocks());

  it('ajoute une question au survey', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 's1' }] }) // ownership check
      .mockResolvedValueOnce({ rows: [{ id: 'q1', label: 'Comment?', type: 'text' }] }); // insert

    const result = await addQuestion('org-uuid', 's1', { label: 'Comment?', type: 'text' });
    expect(result.id).toBe('q1');
    expect(result.label).toBe('Comment?');
  });
});

describe('submitResponse', () => {
  beforeEach(() => jest.clearAllMocks());

  it('soumet une réponse à un survey actif', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 's1', status: 'active' }] }) // survey check
      .mockResolvedValueOnce({ rows: [{ id: 'r1', survey_id: 's1', visit_id: 'v1' }] }); // insert

    const result = await submitResponse('s1', { visit_id: 'v1', answers: { q1: 'yes' } });
    expect(result.id).toBe('r1');
  });

  it('lève SURVEY_INACTIVE si status != active', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 's1', status: 'closed' }] });
    await expect(submitResponse('s1', { visit_id: 'v1', answers: {} })).rejects.toMatchObject({
      statusCode: 400,
      code: 'SURVEY_INACTIVE',
    });
  });
});
