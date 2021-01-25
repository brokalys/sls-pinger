export const ses = {
  sendEmail: jest.fn().mockReturnValue({ promise: jest.fn() }),
};

export const sns = {
  publish: jest.fn().mockReturnValue({ promise: jest.fn() }),
};

export const s3 = {
  putObject: jest.fn().mockReturnValue({ promise: jest.fn() }),
  getSignedUrlPromise: jest.fn(),
};

const aws = {
  SES: jest.fn().mockReturnValue(ses),
  SNS: jest.fn().mockReturnValue(sns),
  S3: jest.fn().mockReturnValue(s3),
  config: {
    update: jest.fn(),
  },
};

export default aws;
