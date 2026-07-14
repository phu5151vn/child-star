import { LockOutlined, MailOutlined, UserOutlined } from '@ant-design/icons';
import { Button, Card, Form, Grid, Input, Segmented, Space, Typography, message } from 'antd';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api, ApiClientError, type ChildProfile } from '@/api/client';
import { ChildAvatar } from '@/components/CuteBits';
import { useAuth } from '@/features/auth/AuthContext';

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
        Bé Ngoan ⭐
      </Title>
      <Text style={{ color: 'rgba(255,255,255,0.92)', fontSize: isSide ? 15 : 13 }}>
        Tích sao mỗi ngày • Đổi quà siêu vui
      </Text>
    </div>
  );
}

export function LoginPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
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
        message.success(`Đăng ký thành công! Mã gia đình: ${res.family_code}`);
        navigate('/parent');
      } else {
        const res = await api.post<{ access_token: string }>('/auth/parent/login', values);
        login(res.access_token, 'parent');
        navigate('/parent');
      }
    } catch (e) {
      message.error(e instanceof ApiClientError ? e.message : 'Đăng nhập thất bại');
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
            <Segmented
              block
              size="large"
              value={mode}
              onChange={(v) => setMode(v as 'login' | 'register')}
              options={[
                { label: 'Đăng nhập', value: 'login' },
                { label: 'Đăng ký', value: 'register' },
              ]}
            />
            <div>
              <Title level={3} style={{ margin: 0 }}>
                {mode === 'register' ? 'Tạo gia đình mới 🎉' : 'Chào mừng Bố Mẹ! 👋'}
              </Title>
              <Text type="secondary">
                {mode === 'register'
                  ? 'Đăng ký để bắt đầu hành trình nuôi con ngoan.'
                  : 'Hãy đăng nhập để cùng bé chinh phục các nhiệm vụ nhé.'}
              </Text>
            </div>

            <Form layout="vertical" onFinish={onParentSubmit} requiredMark={false}>
              {mode === 'register' && (
                <>
                  <Form.Item name="family_name" label="Tên gia đình" rules={[{ required: true }]}>
                    <Input size="large" placeholder="VD: Gia đình Hạnh Phúc" />
                  </Form.Item>
                  <Form.Item name="display_name" label="Tên bố/mẹ" rules={[{ required: true }]}>
                    <Input size="large" prefix={<UserOutlined />} placeholder="VD: Mẹ Lan" />
                  </Form.Item>
                </>
              )}
              <Form.Item name="email" label="Email của Bố Mẹ" rules={[{ required: true, type: 'email' }]}>
                <Input size="large" prefix={<MailOutlined />} placeholder="bo_me@example.com" />
              </Form.Item>
              <Form.Item name="password" label="Mật khẩu" rules={[{ required: true, min: 6 }]}>
                <Input.Password size="large" prefix={<LockOutlined />} placeholder="••••••••" />
              </Form.Item>
              <Button type="primary" htmlType="submit" block size="large" shape="round" loading={loading}>
                {mode === 'register' ? 'Tạo tài khoản' : 'Đăng nhập Bố Mẹ'}
              </Button>
            </Form>

            <div style={{ textAlign: 'center' }}>
              <Button type="link" onClick={() => navigate('/profiles')} style={{ fontWeight: 600 }}>
                😊 Con đăng nhập tại đây →
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
      message.error(e instanceof ApiClientError ? e.message : 'PIN không đúng');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: PAGE_BG, padding: '20px 24px 48px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 22 }}>⭐</span>
        <Title level={4} style={{ margin: 0, color: '#7C5CFC', fontFamily: '"Baloo 2", cursive' }}>Bé Ngoan</Title>
      </div>

      <div className="bn-fade-up" style={{ maxWidth: 460, margin: '32px auto 0', textAlign: 'center' }}>
        <Title level={3} style={{ margin: 0, fontFamily: '"Baloo 2", cursive' }}>Chọn hồ sơ con</Title>
        <Text type="secondary">Chào mừng bé quay lại! 👋</Text>

        <Card style={{ borderRadius: 24, marginTop: 24, textAlign: 'left' }} styles={{ body: { padding: 20 } }}>
          <Text strong style={{ fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', color: '#797587' }}>
            Mã gia đình
          </Text>
          <Input
            size="large"
            value={familyCode}
            onChange={(e) => setFamilyCode(e.target.value.toUpperCase())}
            placeholder="VD: DEMO01"
            style={{ marginTop: 8, textAlign: 'center', fontWeight: 700, letterSpacing: 2 }}
          />
        </Card>

        {isLoading && <Text style={{ display: 'block', marginTop: 16 }}>Đang tải...</Text>}
        {isError && <Button style={{ marginTop: 16 }} onClick={() => refetch()}>Thử lại</Button>}
        {profiles && profiles.length === 0 && (
          <Text type="secondary" style={{ display: 'block', marginTop: 16 }}>Không tìm thấy hồ sơ con</Text>
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
              Nhập mã PIN của {selectedChild.display_name} 🔒
            </Text>
            <Input.OTP length={4} size="large" value={pin} onChange={setPin} />
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
              Vào chơi! 🚀
            </Button>
          </div>
        )}

        <Link onClick={() => navigate('/login')} style={{ display: 'block', marginTop: 24, fontWeight: 600 }}>
          Đăng nhập với tài khoản khác
        </Link>
      </div>
    </div>
  );
}
