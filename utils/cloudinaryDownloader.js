const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');
const archiver = require('archiver');
const cloudinary = require('cloudinary').v2;
const Document = require('../models/Document');
const Enrollment = require('../models/Enrollment');

const downloadDir = 'downloadfiles';
if (!fs.existsSync(downloadDir)) {
  fs.mkdirSync(downloadDir);
}

function getFolderName(filePath) {
  const res = filePath.split('/').slice(0, -1);
  return res.length < 1 ? false : res;
}

function downloadFile(url, dest, cb) {
  const protocol = url.startsWith('https') ? https : http;
  const file = fs.createWriteStream(dest);

  protocol
    .get(url, function (res) {
      if (res.statusCode !== 200) {
        return cb(new Error(`Failed to download file: ${res.statusCode}`));
      }

      res.pipe(file);
      file.on('finish', function () {
        file.close(cb);
      });
      file.on('error', function (err) {
        fs.unlink(dest, () => {}); // Xóa file lỗi
        cb(err);
      });
    })
    .on('error', function (err) {
      cb(err);
    });
}

// Hàm trích xuất public_id từ Cloudinary URL
function extractPublicIdFromUrl(url) {
  try {
    const urlParts = url.split('/');
    const uploadIndex = urlParts.findIndex((part) => part === 'upload');
    if (uploadIndex === -1) return null;

    // Lấy phần sau 'upload' và bỏ version nếu có
    let publicIdPart = urlParts.slice(uploadIndex + 1).join('/');

    // Bỏ version (vXXXXXXXXXX) nếu có
    publicIdPart = publicIdPart.replace(/\/v\d+\//, '/');

    // Bỏ extension
    const lastDotIndex = publicIdPart.lastIndexOf('.');
    if (lastDotIndex > 0) {
      publicIdPart = publicIdPart.substring(0, lastDotIndex);
    }

    return publicIdPart;
  } catch (error) {
    console.error('Error extracting public_id:', error);
    return null;
  }
}

// Hàm download file từ URL với tên file tùy chỉnh
async function downloadFileFromUrl(url, fileName, documentId) {
  return new Promise((resolve, reject) => {
    try {
      const documentDir = path.join(downloadDir, documentId);
      if (!fs.existsSync(documentDir)) {
        fs.mkdirSync(documentDir, { recursive: true });
      }

      const filePath = path.join(documentDir, fileName);

      downloadFile(url, filePath, (err) => {
        if (err) {
          console.error(`Error downloading file ${fileName}:`, err);
          reject(err);
        } else {
          console.log(`✅ Downloaded: ${fileName}`);
          resolve(filePath);
        }
      });
    } catch (error) {
      reject(error);
    }
  });
}

// Hàm download và tạo ZIP cho document
async function downloadDocumentAsZip(documentId, userId = null) {
  try {
    // Tìm document
    const document = await Document.findById(documentId);
    if (!document) {
      throw new Error('Không tìm thấy tài liệu');
    }

    // Kiểm tra quyền truy cập nếu có userId
    if (userId) {
      // Kiểm tra nếu user đã mua tài liệu
      const enrollment = await Enrollment.findOne({
        userId,
        documentId,
      });

      // Kiểm tra nếu user là tác giả
      const isAuthor = document.author.toString() === userId.toString();

      // Kiểm tra nếu tài liệu miễn phí
      const isFree = document.isFree || document.price === 0;

      if (!enrollment && !isAuthor && !isFree) {
        throw new Error('Bạn không có quyền truy cập tài liệu này');
      }
    }

    const documentDir = path.join(downloadDir, documentId);
    const zipPath = path.join(downloadDir, `prilab_document_${documentId}.zip`);

    // Tạo thư mục tạm cho document
    if (!fs.existsSync(documentDir)) {
      fs.mkdirSync(documentDir, { recursive: true });
    }

    const downloadedFiles = [];
    let fileCounter = 1;

    // Download document files
    if (document.documentUrls && document.documentUrls.length > 0) {
      console.log(
        `📄 Downloading ${document.documentUrls.length} document files...`
      );

      for (const url of document.documentUrls) {
        try {
          const extension = path.extname(url).split('?')[0] || '.pdf';
          const fileName = `document_${fileCounter}${extension}`;

          await downloadFileFromUrl(url, fileName, documentId);
          downloadedFiles.push(fileName);
          fileCounter++;
        } catch (error) {
          console.error(`Error downloading document file:`, error);
        }
      }
    }

    // Download image files
    if (document.imageUrls && document.imageUrls.length > 0) {
      console.log(`🖼️ Downloading ${document.imageUrls.length} image files...`);

      let imageCounter = 1;
      for (const url of document.imageUrls) {
        try {
          const extension = path.extname(url).split('?')[0] || '.jpg';
          const fileName = `image_${imageCounter}${extension}`;

          await downloadFileFromUrl(url, fileName, documentId);
          downloadedFiles.push(fileName);
          imageCounter++;
        } catch (error) {
          console.error(`Error downloading image file:`, error);
        }
      }
    }

    // Download video files
    if (document.videoUrls && document.videoUrls.length > 0) {
      console.log(`🎥 Downloading ${document.videoUrls.length} video files...`);

      let videoCounter = 1;
      for (const url of document.videoUrls) {
        try {
          const extension = path.extname(url).split('?')[0] || '.mp4';
          const fileName = `video_${videoCounter}${extension}`;

          await downloadFileFromUrl(url, fileName, documentId);
          downloadedFiles.push(fileName);
          videoCounter++;
        } catch (error) {
          console.error(`Error downloading video file:`, error);
        }
      }
    }

    // Tạo file ZIP
    await createZipFile(documentDir, zipPath);

    // Cập nhật download count
    await Document.findByIdAndUpdate(documentId, {
      $inc: { download: 1 },
    });

    // Xóa thư mục tạm sau khi tạo ZIP
    setTimeout(() => {
      if (fs.existsSync(documentDir)) {
        fs.rmSync(documentDir, { recursive: true, force: true });
        console.log(`🗑️ Cleaned up temp directory: ${documentDir}`);
      }
    }, 1000);

    return {
      success: true,
      zipPath,
      document: {
        id: document._id,
        title: document.title,
        description: document.description,
      },
      totalFiles: downloadedFiles.length,
    };
  } catch (error) {
    console.error('Error downloading document:', error);
    throw error;
  }
}

// Hàm tạo ZIP file
function createZipFile(sourceDir, zipPath) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => {
      console.log(`📦 Created ZIP: ${zipPath} (${archive.pointer()} bytes)`);
      resolve(zipPath);
    });

    archive.on('error', (err) => reject(err));
    archive.pipe(output);
    archive.directory(sourceDir, false);
    archive.finalize();
  });
}

// Hàm download tất cả resources (giữ nguyên chức năng cũ)
async function callCloudinaryAPI(type = 'image', no = 10, cursor = null) {
  const opt = {
    resource_type: type,
    max_results: no,
  };
  if (cursor) {
    opt.next_cursor = cursor;
  }

  return new Promise((resolve, reject) => {
    cloudinary.api.resources(opt, async function (error, result) {
      if (error) return reject(error);

      for (const resource of result.resources) {
        const folders = getFolderName(resource.public_id);
        let folderPath = downloadDir + '/';

        if (folders) {
          for (const folder of folders) {
            folderPath += folder + '/';
            if (!fs.existsSync(folderPath)) {
              fs.mkdirSync(folderPath);
            }
          }
        }

        const filePath = `${downloadDir}/${resource.public_id}.${
          resource.format || ''
        }`;
        await new Promise((res) => downloadFile(resource.url, filePath, res));
      }

      if (result.next_cursor) {
        await callCloudinaryAPI(type, no, result.next_cursor);
      }

      resolve(true);
    });
  });
}

async function downloadAllResources(fileTypes) {
  for (const type of fileTypes) {
    await callCloudinaryAPI(type, 200);
  }
}

module.exports = {
  downloadAllResources,
  downloadDocumentAsZip,
  extractPublicIdFromUrl,
};
