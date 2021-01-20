export const sns = {
  publish: jest.fn().mockReturnValue({ promise: jest.fn() }),
};

const aws = {
  SNS: jest.fn().mockReturnValue(sns),
};

export default aws;
