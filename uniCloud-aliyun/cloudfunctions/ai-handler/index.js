'use strict';

// 阿里云DashScope API配置
// 模型已从 wanx-sketch-to-image-lite 升级到 wanx2.1-plus (2025年最新版本)
// 支持更高分辨率(1024x1024)和更好的图像质量
const API_KEY = 'sk-f67242261758413097c58393e0f166ef';
const BASE_URL = 'https://dashscope.aliyuncs.com/api/v1';

exports.main = async (event) => {
  const { action, sketchUrl, sketchDataUrl, taskId, prompt } = event || {};

  if (action === 'submitTask') {
    try {
      let refImageUrl = sketchUrl || '';

      if (refImageUrl && refImageUrl.indexOf('cloud://') === 0) {
        refImageUrl = await resolveCloudFileToTempUrl(refImageUrl);
      }

      if (!refImageUrl && sketchDataUrl) {
        refImageUrl = await uploadSketchFromDataUrl(sketchDataUrl);
      }

      if (!refImageUrl) {
        return {
          success: false,
          msg: '缺少可用的草图图片数据'
        };
      }

      const res = await uniCloud.httpclient.request(
        `${BASE_URL}/services/aigc/image2image/image-synthesis`,
        {
          method: 'POST',
          dataType: 'json',
          headers: {
            Authorization: `Bearer ${API_KEY}`,
            'X-DashScope-Async': 'enable',
            'Content-Type': 'application/json'
          },
          data: {
            model: 'wanx2.1-imageedit',
            input: {
              prompt: prompt || '根据草图生成一张完整、精致的图像',
              base_image_url: refImageUrl,
              function: 'doodle'
            },
            parameters: {
              n: 1,
              size: '1024*1024',
              strength: 0.85
            }
          }
        }
      );

      console.log('submitTask request image url', refImageUrl);
      console.log('submitTask response', JSON.stringify(res && res.data ? res.data : null));

      const output = res && res.data ? res.data.output : null;
      if (!output || !output.task_id) {
        return {
          success: false,
          msg: '阿里云未返回任务编号',
          data: res && res.data ? res.data : null
        };
      }

      return {
        success: true,
        taskId: output.task_id
      };
    } catch (error) {
      return {
        success: false,
        msg: '提交失败',
        error: normalizeError(error)
      };
    }
  }

  if (action === 'queryTask') {
    try {
      const res = await uniCloud.httpclient.request(`${BASE_URL}/tasks/${taskId}`, {
        method: 'GET',
        dataType: 'json',
        headers: {
          Authorization: `Bearer ${API_KEY}`
        }
      });

      return {
        success: true,
        data: res && res.data ? res.data.output : null
      };
    } catch (error) {
      return {
        success: false,
        msg: '查询失败',
        error: normalizeError(error)
      };
    }
  }

  return {
    success: false,
    msg: '不支持的操作'
  };
};

async function uploadSketchFromDataUrl(dataUrl) {
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) {
    throw new Error('草图数据格式无效');
  }

  const uploadRes = await uniCloud.uploadFile({
    cloudPath: `sketch-${Date.now()}.${parsed.ext}`,
    fileContent: Buffer.from(parsed.base64, 'base64')
  });

  const fileID = uploadRes && uploadRes.fileID ? uploadRes.fileID : '';
  if (!fileID) {
    throw new Error('草图上传成功，但未返回文件地址');
  }

  if (fileID.indexOf('cloud://') === 0) {
    return await resolveCloudFileToTempUrl(fileID);
  }

  return fileID;
}

function parseDataUrl(dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string') {
    return null;
  }
  const matched = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!matched) {
    return null;
  }

  const mime = matched[1];
  const ext = mime.indexOf('jpeg') > -1 ? 'jpg' : mime.split('/')[1] || 'png';

  return {
    mime,
    ext,
    base64: matched[2]
  };
}

async function resolveCloudFileToTempUrl(fileID) {
  const tempRes = await uniCloud.getTempFileURL({
    fileList: [fileID]
  });
  const fileList = tempRes && tempRes.fileList ? tempRes.fileList : [];
  if (fileList.length > 0 && fileList[0].tempFileURL) {
    return fileList[0].tempFileURL;
  }
  throw new Error('未获取到云文件临时地址');
}

function normalizeError(error) {
  if (!error) {
    return '未知错误';
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error.message) {
    return error.message;
  }
  if (error.errMsg) {
    return error.errMsg;
  }
  try {
    return JSON.stringify(error);
  } catch (jsonError) {
    return '无法解析错误信息';
  }
}
