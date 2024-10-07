const fs = require('fs');

module.exports = (on, config) => {
  on('task', {
    appendToFile({ filePath, content }) {
      return new Promise((resolve, reject) => {
        fs.appendFile(filePath, content, (err) => {
          if (err) {
            return reject(err);
          }
          resolve(true);
        });
      });
    }
  });
};
