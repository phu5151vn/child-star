import { Upload, message } from 'antd';
import { LoadingOutlined, PlusOutlined } from '@ant-design/icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { UploadFile, UploadProps } from 'antd';
import { api } from '@/api/client';

interface MediaUploadProps {
  kind: 'task_icon' | 'reward_image' | 'proof' | 'avatar';
  value?: string;
  onChange?: (mediaId: string | undefined) => void;
}

export function MediaUpload({ kind, value: _mediaId, onChange }: MediaUploadProps) {
  const { t } = useTranslation();
  const [uploading, setUploading] = useState(false);
  const [fileList, setFileList] = useState<UploadFile[]>([]);

  const handleUpload: UploadProps['customRequest'] = async ({ file, onSuccess, onError }) => {
    setUploading(true);
    try {
      const result = await api.upload(file as File, kind);
      const mediaId = String(result.media_id);
      onChange?.(mediaId);
      setFileList([{ uid: mediaId, name: (file as File).name, status: 'done' }]);
      onSuccess?.(result);
      message.success(t('components:mediaUpload.uploadSuccess'));
    } catch (e) {
      const msg = e instanceof Error ? e.message : t('components:mediaUpload.uploadError');
      message.error(msg);
      onError?.(e as Error);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Upload
      listType="picture-card"
      fileList={fileList}
      accept="image/png,image/jpeg,image/webp"
      maxCount={1}
      customRequest={handleUpload}
      onRemove={() => {
        setFileList([]);
        onChange?.(undefined);
      }}
      showUploadList={{ showPreviewIcon: true }}
    >
      {fileList.length === 0 && (
        <div>
          {uploading ? <LoadingOutlined /> : <PlusOutlined />}
          <div style={{ marginTop: 8 }}>{t('components:mediaUpload.selectPhoto')}</div>
        </div>
      )}
    </Upload>
  );
}
