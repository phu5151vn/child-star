import { LockOutlined, MailOutlined, UserOutlined } from '@ant-design/icons';
import { Button, Card, Form, Grid, Input, Segmented, Space, Typography, message } from 'antd';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api, ApiClientError, type ChildProfile } from '@/api/client';
import { ChildAvatar } from '@/components/CuteBits';
import { useAuth } from '@/features/auth/AuthContext';
import { LanguageSwitcher } from '@/i18n/LanguageSwitcher';

const { Title, Text, Link } = Typography;
const { useBreakpoint } = Grid;

const PAGE_BG = 'linear-gradient(160deg,#f3efff 0%,#fbf7ff 40%,#fdeef7 100%)';

/** Ngôi sao lấp lánh trang trí trên nền gradient. */
function Sparkle({ top, left, size, delay }: { top: string; left: string; size: number; delay: string }) {
  return (
    <span
      className="bn-float"
      style={{ position: 'absolute', top, left, fontSize: size, opacity: 0.85, animationDelay: delay, pointerEvents: 'none' }}
    >
      ✨
    </span>
  );
}

/** Panel thương hiệu gradient + mascot, dùng cho cả desktop (bên trái) và mobile (banner trên). */
function BrandHero({ variant }: { variant: 'side' | 'top' }) {
  const { t } = useTranslation();
  const isSide = variant === 'side';
  return (
    <div
      className="bn-gradient-header"
      style={{
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        width: isSide ? 360 : '100%',
        padding: isSide ? 40 : '28px 24px',
      }}
    >
      <Sparkle top="12%" left="16%" size={22} delay="0s" />
      <Sparkle top="20%" left="78%" size={16} delay="0.6s" />
      <Sparkle top="72%" left="20%" size={18} delay="1s" />
      <Sparkle top="82%" left="72%" size={24} delay="0.3s" />
      <div
        style={{
          width: isSide ? 170 : 96,
          height: isSide ? 170 : 96,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: isSide ? 20 : 8,
          boxShadow: 'inset 0 0 0 6px rgba(255,255,255,0.15)',
        }}
      >
        <span className="bn-float" style={{ fontSize: isSide ? 90 : 52 }} role="img" aria-label="mascot">🧸</span>
      </div>
      <Title level={isSide ? 2 : 3} style={{ color: '#fff', margin: 0, fontFamily: '"Baloo 2", cursive' }}>
        {t('brand.name')} ⭐
      </Title>
      <Text style={{ color: 'rgba(255,255,255,0.92)', fontSize: isSide ? 15 : 13 }}>
        {t('brand.heroTagline')}
      </Text>
    </div>
  );
}

export function LoginPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const { t } = useTranslation();
  const { login } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  const onParentSubmit = async (values: { email: string; password: string; family_name?: string; display_name?: string }) => {
    setLoading(true);
    try {
      if (mode === 'register') {
        const res = await api.post<{ access_token: string; family_code: string }>('/auth/register', values);
        login(res.access_token, 'parent');
        message.success(t('auth:registerSuccess', { code: res.family_code }));
        navigate('/parent');
      } else {
        const res = await api.post<{ access_token: string }>('/auth/parent/login', values);
        login(res.access_token, 'parent');
        navigate('/parent');
      }
    } catch (e) {
      message.error(e instanceof ApiClientError ? e.message : t('auth:loginFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: PAGE_BG }}>
      <div
        className="bn-fade-up"
        style={{
          width: '100%',
          maxWidth: isMobile ? 440 : 940,
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          background: '#fff',
          borderRadius: 32,
          overflow: 'hidden',
          boxShadow: '0 30px 70px -30px rgba(124,92,252,0.55)',
        }}
      >
        <BrandHero variant={isMobile ? 'top' : 'side'} />

        <div style={{ flex: 1, padding: isMobile ? '28px 24px 32px' : '48px 44px' }}>
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <LanguageSwitcher />
            </div>
            <Segmented
              block
              size="large"
              value={mode}
              onChange={(v) => setMode(v as 'login' | 'register')}
              options={[
                { label: t('auth:tabLogin'), value: 'login' },
                { label: t('auth:tabRegister'), value: 'register' },
              ]}
            />
            <div>
              <Title level={3} style={{ margin: 0 }}>
                {mode === 'register' ? t('auth:registerTitle') : t('auth:loginTitle')}
              </Title>
              <Text type="secondary">
                {mode === 'register' ? t('auth:registerSubtitle') : t('auth:loginSubtitle')}
              </Text>
            </div>

            <Form layout="vertical" onFinish={onParentSubmit} requiredMark={false}>
              {mode === 'register' && (
                <>
                  <Form.Item name="family_name" label={t('auth:familyName')} rules={[{ required: true }]}>
                    <Input size="large" placeholder={t('auth:familyNamePlaceholder')} />
                  </Form.Item>
                  <Form.Item name="display_name" label={t('auth:parentName')} rules={[{ required: true }]}>
                    <Input size="large" prefix={<UserOutlined />} placeholder={t('auth:parentNamePlaceholder')} />
                  </Form.Item>
                </>
              )}
              <Form.Item name="email" label={t('auth:parentEmail')} rules={[{ required: true, type: 'email' }]}>
                <Input size="large" prefix={<MailOutlined />} placeholder="bo_me@example.com" />
              </Form.Item>
              <Form.Item name="password" label={t('auth:password')} rules={[{ required: true, min: 6 }]}>
                <Input.Password size="large" prefix={<LockOutlined />} placeholder="••••••••" />
              </Form.Item>
              <Button type="primary" htmlType="submit" block size="large" shape="round" loading={loading}>
                {mode === 'register' ? t('auth:submitRegister') : t('auth:submitLogin')}
              </Button>
            </Form>

            <div style={{ textAlign: 'center' }}>
              <Button type="link" onClick={() => navigate('/profiles')} style={{ fontWeight: 600 }}>
                {t('auth:childLoginLink')}
              </Button>
            </div>
          </Space>
        </div>
      </div>
    </div>
  );
}

export function ProfilesPage() {
  const [familyCode, setFamilyCode] = useState('');
  const [selectedChild, setSelectedChild] = useState<ChildProfile | null>(null);
  const [pin, setPin] = useState('');
  const { t } = useTranslation();
  const { login } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const { data: profiles, isLoading, isError, refetch } = useQuery({
    queryKey: ['child-profiles', familyCode],
    queryFn: () => api.get<ChildProfile[]>(`/auth/child/profiles?family_code=${familyCode}`),
    enabled: familyCode.length >= 4,
  });

  const handleLogin = async () => {
    if (!selectedChild || pin.length !== 4) return;
    setLoading(true);
    try {
      const res = await api.post<{ access_token: string }>('/auth/child/login', {
        family_code: familyCode,
        child_id: selectedChild.id,
        pin,
      });
      login(res.access_token, 'child');
      navigate('/child');
    } catch (e) {
      message.error(e instanceof ApiClientError ? e.message : t('auth:wrongPin'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: PAGE_BG, padding: '20px 24px 48px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 22 }}>⭐</span>
        <Title level={4} style={{ margin: 0, color: '#7C5CFC', fontFamily: '"Baloo 2", cursive' }}>{t('brand.name')}</Title>
        <div style={{ marginLeft: 'auto' }}>
          <LanguageSwitcher />
        </div>
      </div>

      <div className="bn-fade-up" style={{ maxWidth: 460, margin: '32px auto 0', textAlign: 'center' }}>
        <Title level={3} style={{ margin: 0, fontFamily: '"Baloo 2", cursive' }}>{t('auth:chooseProfile')}</Title>
        <Text type="secondary">{t('auth:welcomeBack')}</Text>

        <Card style={{ borderRadius: 24, marginTop: 24, textAlign: 'left' }} styles={{ body: { padding: 20 } }}>
          <Text strong style={{ fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', color: '#797587' }}>
            {t('auth:familyCode')}
          </Text>
          <Input
            size="large"
            value={familyCode}
            onChange={(e) => setFamilyCode(e.target.value.toUpperCase())}
            placeholder={t('auth:familyCodePlaceholder')}
            style={{ marginTop: 8, textAlign: 'center', fontWeight: 700, letterSpacing: 2 }}
          />
        </Card>

        {isLoading && <Text style={{ display: 'block', marginTop: 16 }}>{t('state.loading')}</Text>}
        {isError && <Button style={{ marginTop: 16 }} onClick={() => refetch()}>{t('state.retry')}</Button>}
        {profiles && profiles.length === 0 && (
          <Text type="secondary" style={{ display: 'block', marginTop: 16 }}>{t('auth:noProfiles')}</Text>
        )}

        {!!profiles?.length && (
          <Space wrap size="middle" style={{ marginTop: 24, justifyContent: 'center', width: '100%' }}>
            {profiles.map((p) => {
              const active = selectedChild?.id === p.id;
              return (
                <Card
                  key={p.id}
                  hoverable
                  className="bn-card-hover"
                  onClick={() => setSelectedChild(p)}
                  styles={{ body: { padding: 14 } }}
                  style={{
                    width: 120,
                    textAlign: 'center',
                    borderRadius: 22,
                    borderWidth: active ? 3 : 1,
                    borderColor: active ? '#7C5CFC' : '#eee',
                    boxShadow: active ? '0 10px 24px -10px rgba(124,92,252,0.7)' : undefined,
                  }}
                >
                  <ChildAvatar name={p.display_name} gender={p.gender} size={64} float={active} />
                  <div style={{ marginTop: 10, fontWeight: 700 }}>{p.display_name}</div>
                </Card>
              );
            })}
          </Space>
        )}

        {selectedChild && (
          <div style={{ marginTop: 28 }}>
            <Text strong style={{ display: 'block', marginBottom: 12 }}>
              {t('auth:enterPin', { name: selectedChild.display_name })}
            </Text>
            <Input.OTP
              length={4}
              size="large"
              value={pin}
              onChange={setPin}
              inputMode="numeric"
              formatter={(str) => str.replace(/\D/g, '')}
            />
            <Button
              type="primary"
              block
              size="large"
              shape="round"
              style={{ marginTop: 20 }}
              loading={loading}
              disabled={pin.length !== 4}
              onClick={handleLogin}
            >
              {t('auth:play')}
            </Button>
          </div>
        )}

        <Link onClick={() => navigate('/login')} style={{ display: 'block', marginTop: 24, fontWeight: 600 }}>
          {t('auth:otherAccount')}
        </Link>
      </div>
    </div>
  );
}
