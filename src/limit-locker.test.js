import moment from 'moment';
import * as db from './shared/db';
import sns from './shared/sns';
import { run } from './limit-locker';
import {
  createPingerFixture,
  createPropertyQueueItemFixture,
} from '__fixtures__';

jest.mock('moment');
jest.mock('./shared/db');
jest.mock('./shared/sns');

const TEST_EMAIL_1 = 'test+1@brokalys.com';
const TEST_EMAIL_2 = 'test+2@brokalys.com';

describe('limit-locker', () => {
  let isBefore;

  // TODO: remove the date hack after February
  beforeEach(() => {
    isBefore = jest.fn().mockReturnValue(false);
    moment.mockReturnValue({ isBefore });
  });

  afterEach(jest.clearAllMocks);

  test('sends an email SNS notification', async () => {
    db.getEmailsThatShouldBeLimitLocked.mockReturnValue([
      TEST_EMAIL_1,
      TEST_EMAIL_2,
    ]);
    db.getEmailsWithLimitLockerNotification.mockReturnValue([]);

    await run();

    expect(sns.publish).toBeCalledTimes(2);
    expect(sns.publish.mock.calls[0]).toMatchSnapshot();
  });

  test('does not send a email SNS notification for the customer that has already received one', async () => {
    db.getEmailsThatShouldBeLimitLocked.mockReturnValue([
      TEST_EMAIL_1,
      TEST_EMAIL_2,
    ]);
    db.getEmailsWithLimitLockerNotification.mockReturnValue([TEST_EMAIL_1]);

    await run();

    expect(sns.publish).toBeCalledTimes(1);
    expect(sns.publish.mock.calls[0]).toMatchSnapshot();
  });

  test('stops early if no emails should be limit-locked', async () => {
    db.getEmailsThatShouldBeLimitLocked.mockReturnValue([]);

    await run();

    expect(db.limitLockPingerEmails).not.toBeCalled();
    expect(sns.publish).not.toBeCalled();
  });

  test('updates the limit-locked timestamp for locked emails', async () => {
    db.getEmailsThatShouldBeLimitLocked.mockReturnValue([TEST_EMAIL_1]);

    await run();

    expect(db.limitLockPingerEmails).toBeCalledWith([TEST_EMAIL_1]);
  });

  // TODO: remove the date hack after February
  test('does not send a email SNS notification if it is not yet February, but still locks', async () => {
    isBefore.mockReturnValue(true);
    db.getEmailsThatShouldBeLimitLocked.mockReturnValue([TEST_EMAIL_1]);
    db.getEmailsWithLimitLockerNotification.mockReturnValue([]);

    await run();

    expect(db.limitLockPingerEmails).toBeCalledWith([TEST_EMAIL_1]);
    expect(sns.publish).not.toBeCalled();
  });
});
