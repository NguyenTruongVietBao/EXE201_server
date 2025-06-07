exports.normalizeString = (str) => {
  return str
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Bỏ dấu
    .replace(/\s+/g, ' '); // Thay thế nhiều khoảng trắng bằng 1 khoảng trắng
};
