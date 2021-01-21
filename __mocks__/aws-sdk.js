export const sns = {
  publish: jest.fn().mockReturnValue({ promise: jest.fn() }),
};

const aws = {
  SNS: jest.fn().mockReturnValue(sns),
  config: {
    update: jest.fn(),
  },
};

export default aws;
