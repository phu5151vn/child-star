import { UserOutlined } from '@ant-design/icons';
import { Button, Card, Form, Input, Space, Tabs, Typography, message } from 'antd';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api, ApiClientError, type ChildProfile } from '@/api/client';
import { ChildAvatar } from '@/components/CuteBits';
import { useAuth } from '@/features/auth/AuthContext';

const { Title, Text, Link } = Typography;

export function LoginPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const { login } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

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
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <Card style={{ width: '100%', maxWidth: 420 }}>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Title level={2} style={{ textAlign: 'center', fontFamily: '"Baloo 2", cursive', margin: 0 }}>
            Bé Ngoan ⭐
          </Title>
          <Tabs
            activeKey={mode}
            onChange={(k) => setMode(k as 'login' | 'register')}
            items={[
              { key: 'login', label: 'Đăng nhập' },
              { key: 'register', label: 'Đăng ký' },
            ]}
          />
          <Form layout="vertical" onFinish={onParentSubmit}>
            {mode === 'register' && (
              <>
                <Form.Item name="family_name" label="Tên gia đình" rules={[{ required: true }]}>
                  <Input />
                </Form.Item>
                <Form.Item name="display_name" label="Tên bố/mẹ" rules={[{ required: true }]}>
                  <Input prefix={<UserOutlined />} />
                </Form.Item>
              </>
            )}
            <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}>
              <Input />
            </Form.Item>
            <Form.Item name="password" label="Mật khẩu" rules={[{ required: true, min: 6 }]}>
              <Input.Password />
            </Form.Item>
            <Button type="primary" htmlType="submit" block loading={loading}>
              {mode === 'register' ? 'Tạo tài khoản' : 'Đăng nhập Bố Mẹ'}
            </Button>
          </Form>
          <Link onClick={() => navigate('/profiles')}>Con đăng nhập tại đây →</Link>
        </Space>
      </Card>
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
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <Card style={{ width: '100%', maxWidth: 420 }}>
        <Title level={3} style={{ textAlign: 'center', fontFamily: '"Baloo 2", cursive' }}>
          Chọn hồ sơ con
        </Title>
        <Form layout="vertical">
          <Form.Item label="Mã gia đình">
            <Input
              value={familyCode}
              onChange={(e) => setFamilyCode(e.target.value.toUpperCase())}
              placeholder="VD: DEMO01"
            />
          </Form.Item>
        </Form>
        {isLoading && <Text>Đang tải...</Text>}
        {isError && <Button onClick={() => refetch()}>Thử lại</Button>}
        {profiles && profiles.length === 0 && <Text type="secondary">Không tìm thấy hồ sơ con</Text>}
        <Space wrap style={{ marginTop: 16 }}>
          {profiles?.map((p) => (
            <Card
              key={p.id}
              hoverable
              className="bn-card-hover"
              onClick={() => setSelectedChild(p)}
              styles={{ body: { padding: 12 } }}
              style={{
                borderColor: selectedChild?.id === p.id ? '#7C5CFC' : undefined,
                borderWidth: selectedChild?.id === p.id ? 2 : 1,
                width: 110,
                textAlign: 'center',
                borderRadius: 20,
              }}
            >
              <ChildAvatar name={p.display_name} gender={p.gender} size={56} />
              <div style={{ marginTop: 8, fontWeight: 600 }}>{p.display_name}</div>
            </Card>
          ))}
        </Space>
        {selectedChild && (
          <Space direction="vertical" style={{ width: '100%', marginTop: 24 }}>
            <Text>Nhập PIN 4 số cho {selectedChild.display_name}</Text>
            <Input.OTP length={4} value={pin} onChange={setPin} />
            <Button type="primary" block loading={loading} disabled={pin.length !== 4} onClick={handleLogin}>
              Vào chơi!
            </Button>
          </Space>
        )}
        <Link onClick={() => navigate('/login')} style={{ display: 'block', marginTop: 16 }}>
          ← Bố mẹ đăng nhập
        </Link>
      </Card>
    </div>
  );
}
