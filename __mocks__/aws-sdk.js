export const ses = {
  sendEmail: jest.fn().mockReturnValue({ promise: jest.fn() }),
};

export const sns = {
  publish: jest.fn().mockReturnValue({ promise: jest.fn() }),
};

const aws = {
  SES: jest.fn().mockReturnValue(ses),
  SNS: jest.fn().mockReturnValue(sns),
  config: {
    update: jest.fn(),
  },
};

export default aws;
