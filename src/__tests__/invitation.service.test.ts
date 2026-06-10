jest.mock('../db/client', () => {
  const clientQueryMock = jest.fn();
  const releaseMock = jest.fn();
  return {
    default: {
      query: jest.fn(),
      connect: jest.fn().mockResolvedValue({
        query: clientQueryMock,
        release: releaseMock,
      }),
    },
    __esModule: true,
    __mockClientQuery: clientQueryMock,
    __mockRelease: releaseMock,
  };
});

jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: jest.fn().mockResolvedValue({ id: 'email-id' }) },
  })),
}));

import pool from '../db/client';
import { inviteByEmail, addExistingUser, acceptInvitation } from '../services/invitation.service';

const mockQuery = pool.query as jest.Mock;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const poolModule = require('../db/client');
const mockClientQuery = poolModule.__mockClientQuery as jest.Mock;

describe('inviteByEmail', () => {
  beforeEach(() => jest.clearAllMocks());

  it('crée une invitation et envoie un email', async () => {
    mockQuery.mockResolvedValueOnce({}); // INSERT invitation

    await expect(inviteByEmail('org-id', 'inviter-id', 'guest@example.com', 'editor')).resolves.toBeUndefined();
    expect(mockQuery).toHaveBeenCalledTimes(1);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO invitations'),
      expect.any(Array)
    );
  });
});

describe('addExistingUser', () => {
  beforeEach(() => jest.clearAllMocks());

  it('ajoute un utilisateur existant à l organisation', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'user-uuid' }] }) // SELECT user
      .mockResolvedValueOnce({ rows: [] })                    // SELECT existing membership (not member)
      .mockResolvedValueOnce({});                             // INSERT membership

    await expect(addExistingUser('org-id', 'user@example.com', 'editor')).resolves.toBeUndefined();
  });

  it('lève 404 USER_NOT_FOUND si email inconnu', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await expect(addExistingUser('org-id', 'unknown@example.com', 'editor')).rejects.toMatchObject({
      statusCode: 404,
      code: 'USER_NOT_FOUND',
    });
  });

  it('lève 409 ALREADY_MEMBER si déjà membre', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id: 'user-uuid' }] })    // SELECT user
      .mockResolvedValueOnce({ rows: [{ id: 'member-uuid' }] }); // SELECT existing membership (already member)

    await expect(addExistingUser('org-id', 'user@example.com', 'editor')).rejects.toMatchObject({
      statusCode: 409,
      code: 'ALREADY_MEMBER',
    });
  });
});

describe('acceptInvitation', () => {
  beforeEach(() => jest.clearAllMocks());

  it('accepte une invitation valide et crée le membership', async () => {
    const invitation = {
      id: 'inv-uuid',
      organization_id: 'org-uuid',
      email: 'guest@example.com',
      role: 'editor',
      expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24), // 1 day future
      accepted_at: null,
    };

    // pool.query call: SELECT invitation
    mockQuery.mockResolvedValueOnce({ rows: [invitation] });

    // client.query calls: BEGIN, SELECT user, INSERT membership, UPDATE invitation, COMMIT
    mockClientQuery
      .mockResolvedValueOnce({})                               // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: 'user-uuid' }] }) // SELECT user
      .mockResolvedValueOnce({})                               // INSERT membership
      .mockResolvedValueOnce({})                               // UPDATE invitation
      .mockResolvedValueOnce({});                              // COMMIT

    await expect(acceptInvitation('rawtoken')).resolves.toBeUndefined();
    expect(mockClientQuery).toHaveBeenCalledWith('BEGIN');
    expect(mockClientQuery).toHaveBeenCalledWith('COMMIT');
  });

  it('lève 404 INVITATION_NOT_FOUND si token inconnu', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await expect(acceptInvitation('badtoken')).rejects.toMatchObject({
      statusCode: 404,
      code: 'INVITATION_NOT_FOUND',
    });
  });

  it('lève 409 INVITATION_USED si déjà acceptée', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: 'inv',
        accepted_at: new Date(),
        expires_at: new Date(Date.now() + 99999),
        email: 'x@x.com',
        role: 'editor',
        organization_id: 'org',
      }],
    });

    await expect(acceptInvitation('token')).rejects.toMatchObject({
      statusCode: 409,
      code: 'INVITATION_USED',
    });
  });

  it('lève 410 INVITATION_EXPIRED si expirée', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id: 'inv',
        accepted_at: null,
        expires_at: new Date(Date.now() - 1000), // expired
        email: 'x@x.com',
        role: 'editor',
        organization_id: 'org',
      }],
    });

    await expect(acceptInvitation('token')).rejects.toMatchObject({
      statusCode: 410,
      code: 'INVITATION_EXPIRED',
    });
  });
});
