import { useEffect, useState } from 'react';
import { Image, Skeleton, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { api } from '@/api/client';

interface MediaImageProps {
  mediaId: string;
  /** Cạnh vuông hiển thị (px). */
  size?: number;
  alt?: string;
}

/**
 * Hiển thị ảnh media (vd ảnh minh chứng nhiệm vụ). Vì endpoint /media cần Bearer token,
 * component tải ảnh qua fetch (kèm token) rồi dựng Object URL cho <Image> — hỗ trợ xem phóng to.
 */
export function MediaImage({ mediaId, size = 72, alt }: MediaImageProps) {
  const { t } = useTranslation();
  const [url, setUrl] = useState<string>();
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const altText = alt ?? t('components:mediaImage.proofAlt');

  useEffect(() => {
    let active = true;
    let objectUrl: string | undefined;
    setStatus('loading');
    api
      .fetchMediaObjectUrl(mediaId)
      .then((u) => {
        if (!active) {
          URL.revokeObjectURL(u);
          return;
        }
        objectUrl = u;
        setUrl(u);
        setStatus('ready');
      })
      .catch(() => {
        if (active) setStatus('error');
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [mediaId]);

  if (status === 'loading') {
    return <Skeleton.Image active style={{ width: size, height: size, borderRadius: 12 }} />;
  }
  if (status === 'error' || !url) {
    return (
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        {t('components:mediaImage.loadError')}
      </Typography.Text>
    );
  }
  return (
    <Image
      src={url}
      alt={altText}
      width={size}
      height={size}
      style={{ objectFit: 'cover', borderRadius: 12 }}
    />
  );
}
