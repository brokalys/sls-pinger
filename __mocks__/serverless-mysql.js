const query = jest.fn().mockReturnValue([]);

const mysql = jest.fn().mockReturnValue({
  query,
});

module.exports = {
  query,
  default: mysql,
};
