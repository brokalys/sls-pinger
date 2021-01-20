export const query = jest.fn().mockReturnValue([]);

const mysql = jest.fn().mockReturnValue({
  query,
});

export default mysql;
