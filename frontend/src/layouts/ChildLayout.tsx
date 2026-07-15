import {
  GiftOutlined,
  HistoryOutlined,
  HomeOutlined,
  LogoutOutlined,
  StarOutlined,
} from '@ant-design/icons';
import { Layout, theme, Typography } from 'antd';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ChildAvatar } from '@/components/CuteBits';
import { PointsBadge } from '@/components/PointsBadge';
import { useAuth } from '@/features/auth/AuthContext';

const { Header, Content } = Layout;
const { Title } = Typography;

export function ChildLayout() {
  const { token } = theme.useToken();
  const navigate = useNavigate();
  const location = useLocation();
  const { me, logout } = useAuth();

  const pathKey = location.pathname.startsWith('/child/tasks')
    ? 'tasks'
    : location.pathname.startsWith('/child/rewards')
      ? 'rewards'
      : location.pathname.startsWith('/child/history')
        ? 'history'
        : 'home';

  const tabItems = [
    { key: 'home', label: 'Trang chính', icon: <HomeOutlined />, path: '/child' },
    { key: 'tasks', label: 'Nhiệm vụ', icon: <StarOutlined />, path: '/child/tasks' },
    { key: 'rewards', label: 'Kho thưởng', icon: <GiftOutlined />, path: '/child/rewards' },
    { key: 'history', label: 'Lịch sử', icon: <HistoryOutlined />, path: '/child/history' },
  ];

  return (
    <Layout style={{ minHeight: '100vh', background: token.colorBgLayout }}>
      <Header
        className="bn-gradient-header"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: `0 ${token.paddingMD}px`,
          height: 72,
          position: 'sticky',
          top: 0,
          zIndex: 10,
          boxShadow: '0 4px 16px -8px rgba(124,92,252,0.6)',
        }}
      >
        <SpaceRow>
          <ChildAvatar name={me?.display_name} gender={me?.gender} size={46} float />
          <Title level={4} style={{ margin: 0, color: '#fff', fontFamily: '"Baloo 2", cursive' }}>
            Chào {me?.display_name}! 👋
          </Title>
        </SpaceRow>
        <SpaceRow>
          <div
            style={{
              background: '#fff',
              borderRadius: 999,
              padding: '2px 14px',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <PointsBadge balance={me?.balance ?? 0} size="small" />
          </div>
          <LogoutOutlined onClick={logout} style={{ cursor: 'pointer', fontSize: 18, color: '#fff' }} />
        </SpaceRow>
      </Header>
      <Content style={{ padding: token.paddingMD, paddingBottom: 88 }}>
        <div className="bn-fade-up">
          <Outlet />
        </div>
      </Content>
      <nav
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          display: 'flex',
          background: token.colorBgContainer,
          borderTop: `1px solid ${token.colorBorderSecondary}`,
          borderRadius: '22px 22px 0 0',
          boxShadow: '0 -6px 20px -10px rgba(124,92,252,0.4)',
          paddingBottom: 'env(safe-area-inset-bottom)',
          zIndex: 100,
        }}
      >
        {tabItems.map((t) => {
          const active = pathKey === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => navigate(t.path)}
              aria-current={active ? 'page' : undefined}
              style={{
                flex: 1,
                minWidth: 0,
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
                padding: '10px 4px 12px',
                color: active ? token.colorPrimary : token.colorTextSecondary,
              }}
            >
              <span
                style={{
                  fontSize: 22,
                  lineHeight: 1,
                  padding: '5px 18px',
                  borderRadius: 999,
                  background: active ? token.colorPrimaryBg : 'transparent',
                  transition: 'background 0.2s ease',
                }}
              >
                {t.icon}
              </span>
              <span style={{ fontSize: 12, fontWeight: active ? 700 : 500 }}>{t.label}</span>
            </button>
          );
        })}
      </nav>
    </Layout>
  );
}

function SpaceRow({ children }: { children: React.ReactNode }) {
  const { token } = theme.useToken();
  return <div style={{ display: 'flex', alignItems: 'center', gap: token.marginSM }}>{children}</div>;
}
