import * as db from './shared/db';
import sns from './shared/sns';
import { run } from './limit-locker';
import {
  createPingerFixture,
  createPropertyQueueItemFixture,
} from '__fixtures__';

jest.mock('./shared/db');
jest.mock('./shared/sns');

const TEST_EMAIL_1 = 'test+1@brokalys.com';
const TEST_EMAIL_2 = 'test+2@brokalys.com';

const context = {
  invokedFunctionArn: 'arn:aws:lambda:eu-west-1:111111111111:lambda',
};

describe('limit-locker', () => {
  afterEach(jest.clearAllMocks);

  test('sends an email SNS notification', async () => {
    db.getEmailsThatShouldBeLimitLocked.mockReturnValue([
      TEST_EMAIL_1,
      TEST_EMAIL_2,
    ]);
    db.getEmailsWithLimitLockerNotification.mockReturnValue([]);

    await run({}, context);

    expect(sns.publish).toBeCalledTimes(2);
    expect(sns.publish.mock.calls[0]).toMatchSnapshot();
  });

  test('does not send a email SNS notification for the customer that has already received one', async () => {
    db.getEmailsThatShouldBeLimitLocked.mockReturnValue([
      TEST_EMAIL_1,
      TEST_EMAIL_2,
    ]);
    db.getEmailsWithLimitLockerNotification.mockReturnValue([TEST_EMAIL_1]);

    await run({}, context);

    expect(sns.publish).toBeCalledTimes(1);
    expect(sns.publish.mock.calls[0]).toMatchSnapshot();
  });

  test('stops early if no emails should be limit-locked', async () => {
    db.getEmailsThatShouldBeLimitLocked.mockReturnValue([]);

    await run({}, context);

    expect(db.limitLockPingerEmails).not.toBeCalled();
    expect(sns.publish).not.toBeCalled();
  });

  test('updates the limit-locked timestamp for locked emails', async () => {
    db.getEmailsThatShouldBeLimitLocked.mockReturnValue([TEST_EMAIL_1]);

    await run({}, context);

    expect(db.limitLockPingerEmails).toBeCalledWith([TEST_EMAIL_1]);
  });
});
